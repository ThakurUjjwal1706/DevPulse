package handlers

import (
	"fmt"
	"net/http"

	"devpulse-backend/data"
	"devpulse-backend/models"
	"devpulse-backend/services"

	"github.com/gin-gonic/gin"
)

func PostChat(c *gin.Context) {
	var req models.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	var devContext string
	if req.DeveloperID != "" {
		var developer *models.Developer
		for _, d := range data.Developers {
			if d.ID == req.DeveloperID {
				developer = &d
				break
			}
		}
		if developer != nil {
			metricDetails, healthScore, crossAnalysis := services.RunProductivityEngine(req.DeveloperID)
			
			// Format metrics into a neat contextual prompt
			metricsStr := ""
			for name, m := range metricDetails {
				metricsStr += fmt.Sprintf("- %s: Value = %s, Status = %s\n", name, m.Display, m.Status)
			}

			devContext = fmt.Sprintf(
				"Developer Name: %s\nRole/Level: %s\nTeam: %s\n"+
				"Health Score: %d (%s)\n"+
				"Health Summary: %s\n"+
				"Strongest Driver: %s\n"+
				"Weakest Contributor: %s\n"+
				"Metrics Detail:\n%s"+
				"Cross-Metric Analysis Insights:\n%v",
				developer.Name, developer.Role, developer.Team,
				healthScore.Score, healthScore.Status,
				healthScore.Summary,
				healthScore.StrongestDriver,
				healthScore.WeakestContributor,
				metricsStr,
				crossAnalysis,
			)
		}
	}

	reply, isFallback := services.GenerateChatReply(req.Message, devContext)

	c.JSON(http.StatusOK, models.ChatResponse{
		Reply:      reply,
		IsFallback: isFallback,
	})
}
