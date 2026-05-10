package handlers

import (
	"net/http"

	"devpulse-backend/data"
	"devpulse-backend/services"
	"devpulse-backend/models"

	"github.com/gin-gonic/gin"
)

func GetDevelopers(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"developers": data.Developers})
}

func GetDashboard(c *gin.Context) {
	devID := c.Param("developerId")

	var developer *models.Developer
	for _, d := range data.Developers {
		if d.ID == devID {
			developer = &d
			break
		}
	}

	if developer == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Developer not found"})
		return
	}

	metricDetails, healthScore, crossAnalysis := services.RunProductivityEngine(devID)
	charts := services.GetCharts(devID)
	coaching := services.GenerateCoaching(metricDetails, healthScore, crossAnalysis)

	response := models.DashboardResponse{
		Developer:           *developer,
		Metrics:             metricDetails,
		HealthScore:         healthScore,
		CrossMetricAnalysis: crossAnalysis,
		Coaching:            coaching,
		Charts:              charts,
	}

	c.JSON(http.StatusOK, response)
}
