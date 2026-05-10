package routes

import (
	"devpulse-backend/handlers"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.GET("/developers", handlers.GetDevelopers)
		api.GET("/dashboard/:developerId", handlers.GetDashboard)
	}
}
