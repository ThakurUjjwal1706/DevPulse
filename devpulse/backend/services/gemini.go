package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"devpulse-backend/models"
	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

func GenerateCoaching(details map[string]models.MetricDetail, health models.HealthScoreData, crossAnalysis []string) models.CoachingData {
	fallback := models.CoachingData{
		Strengths: []string{
			"Maintains steady code output over the evaluated period.",
			"Core engineering metrics remain largely within expected operational bounds.",
		},
		OpportunityArea: []string{
			"Cross-metric analysis suggests potential friction in the review or deployment pipeline.",
			"Workflow efficiency could be optimized by addressing specific delivery bottlenecks.",
		},
		ActionPlan: []string{
			"Break down larger Pull Requests into smaller, more reviewable units.",
			"Review current testing coverage to ensure high deployment confidence.",
			"Discuss team process optimizations during the next retro.",
		},
		IsFallback: true,
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Println("No GEMINI_API_KEY found. Utilizing resilient fallback coaching.")
		return fallback
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		log.Println("Error creating Gemini client:", err)
		return fallback
	}
	defer client.Close()

	model := client.GenerativeModel("gemini-1.5-pro-latest")
	
	metricsJSON, _ := json.Marshal(details)
	healthJSON, _ := json.Marshal(health)
	crossJSON, _ := json.Marshal(crossAnalysis)

	prompt := fmt.Sprintf(`
	You are a senior engineering productivity coach. You analyze metrics empathetically and professionally.
	
	Data Context:
	Metrics & Trends: %s
	Health Score Engine: %s
	Cross-Metric Reasoning: %s
	
	Respond with exactly 3 JSON arrays (no markdown):
	{
		"strengths": ["1-2 sentences recognizing healthy metrics, improving trends, or strong team context"],
		"opportunityArea": ["1-2 sentences identifying the primary bottleneck or degrading trend without using punitive language like 'failing' or 'poor'"],
		"actionPlan": ["2-3 practical, concise recommendations an engineer can actually do (e.g., 'Reduce PR scope', 'Automate tests')"]
	}
	`, string(metricsJSON), string(healthJSON), string(crossJSON))

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil || len(resp.Candidates) == 0 {
		log.Println("Gemini API call failed. Using fallback:", err)
		return fallback
	}

	responseText := ""
	for _, part := range resp.Candidates[0].Content.Parts {
		responseText += fmt.Sprintf("%v", part)
	}

	responseText = strings.TrimSpace(responseText)
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	var result models.CoachingData
	err = json.Unmarshal([]byte(responseText), &result)
	if err != nil {
		log.Println("Error parsing JSON from Gemini:", err)
		return fallback
	}
	
	result.IsFallback = false
	return result
}
