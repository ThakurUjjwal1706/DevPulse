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

	model := client.GenerativeModel("gemini-1.5-pro")
	
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

func GenerateChatReply(userMessage string, devContext string) (string, bool) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return localFallbackReply(userMessage), true
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		log.Println("Error creating Gemini client for chat:", err)
		return localFallbackReply(userMessage), true
	}
	defer client.Close()

	model := client.GenerativeModel("gemini-1.5-pro")

	var systemPrompt string
	if devContext != "" {
		systemPrompt = fmt.Sprintf(`You are a helpful, professional AI engineering productivity coach for the DevPulse dashboard.
Below is the current developer context and metrics from the dashboard:
%s

Answer the user's question contextually based on this data. Keep your answer clear, concise, actionable, and formatted in clean Markdown.`, devContext)
	} else {
		systemPrompt = `You are a helpful, professional AI engineering productivity coach for the DevPulse dashboard.
You help users understand DORA metrics (Cycle Time, Lead Time, Deployment Frequency, Bug Escape Rate), PR throughput, and how they relate.
Answer the user's question clearly, concisely, and format your response in clean Markdown.`
	}

	prompt := fmt.Sprintf("%s\n\nUser Question: %s", systemPrompt, userMessage)

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil || len(resp.Candidates) == 0 {
		log.Println("Gemini chat API call failed. Using fallback:", err)
		return localFallbackReply(userMessage), true
	}

	responseText := ""
	for _, part := range resp.Candidates[0].Content.Parts {
		responseText += fmt.Sprintf("%v", part)
	}

	return strings.TrimSpace(responseText), false
}

func localFallbackReply(msg string) string {
	msg = strings.ToLower(msg)
	if strings.Contains(msg, "cycle time") {
		return "⏱ **Cycle Time** measures the average time it takes for a task to go from 'In Progress' to 'Done'.\n\n* **Healthy:** <= 4.0 days\n* **Moderate:** 4.0 - 7.0 days\n* **Opportunity Area:** > 7.0 days\n\n*To improve:* Break tasks into smaller sub-tasks to reduce work-in-progress inventory."
	}
	if strings.Contains(msg, "lead time") {
		return "📦 **Lead Time for Changes** measures the average duration from when a pull request is merged to when it is successfully deployed to production.\n\n* **Healthy:** <= 2.0 days\n* **Moderate:** 2.0 - 5.0 days\n* **Opportunity Area:** > 5.0 days\n\n*To improve:* Automate testing and CI/CD pipelines to release code immediately post-merge."
	}
	if strings.Contains(msg, "deploy") || strings.Contains(msg, "frequency") {
		return "🚀 **Deployment Frequency** tracks how often successful code is deployed to production.\n\n* **Healthy:** >= 4 deployments\n* **Moderate:** 2 - 3 deployments\n* **Opportunity Area:** < 2 deployments\n\n*To improve:* Work in smaller batches and establish continuous deployment habits."
	}
	if strings.Contains(msg, "bug") || strings.Contains(msg, "quality") || strings.Contains(msg, "escape") {
		return "🐛 **Bug Escape Rate** represents the percentage of production-escaped bugs relative to completed tasks.\n\n* **Healthy:** <= 5%\n* **Moderate:** 5% - 15% \n* **Opportunity Area:** > 15%\n\n*To improve:* Invest in unit testing, regression suites, and pull request peer reviews."
	}
	if strings.Contains(msg, "throughput") || strings.Contains(msg, "pr") {
		return "🔀 **PR Throughput** tracks the volume of Pull Requests merged during a sprint.\n\n* **Healthy:** >= 5 PRs\n* **Moderate:** 2 - 4 PRs\n* **Opportunity Area:** < 2 PRs\n\n*To improve:* Keep PR sizes small to expedite peer reviews and speed up integration."
	}
	if strings.Contains(msg, "dora") {
		return "📊 **DORA Metrics** are the industry standard for measuring software delivery performance. They include:\n1. **Deployment Frequency** (how often you ship)\n2. **Lead Time for Changes** (how fast you ship)\n3. **Change Failure Rate** (how often releases fail - proxied by Bug Escape Rate here)\n4. **Time to Restore Service** (how fast you recover)\n\nDevPulse calculates these metrics at both individual and team levels."
	}
	if strings.Contains(msg, "health") || strings.Contains(msg, "score") {
		return "⚡ **Developer Health Score** is a holistic score out of 100 calculated by deducting points for metrics in 'Moderate' (-5 pts) or 'Opportunity Area' (-15 pts) status.\n\nScores >= 85 are classified as **Healthy**, 70-84 as **Moderate**, and < 70 as **Opportunity Area** (At Risk)."
	}
	return "👋 Hello! I am your DevPulse AI Assistant.\n\nI can help explain DORA metrics, debug delivery bottlenecks, and define dashboard calculations. (To unlock fully intelligent project and developer analysis, please add a valid `GEMINI_API_KEY` to your backend `.env` file.)"
}

