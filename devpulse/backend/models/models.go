package models

type Developer struct {
	ID   string `json:"developer_id"`
	Name string `json:"developer_name"`
	Role string `json:"level"`
	Team string `json:"team_name"`
}

type JiraIssue struct {
	ID            string  `json:"issue_id"`
	DeveloperID   string  `json:"developer_id"`
	Status        string  `json:"status"`
	InProgressAt  string  `json:"in_progress_at"`
	DoneAt        string  `json:"done_at"`
	CycleTimeDays float64 `json:"cycle_time_days"`
}

type PullRequest struct {
	ID          string `json:"pr_id"`
	DeveloperID string `json:"developer_id"`
	Status      string `json:"status"`
	OpenedAt    string `json:"opened_at"`
	MergedAt    string `json:"merged_at"`
}

type Deployment struct {
	ID           string  `json:"deployment_id"`
	DeveloperID  string  `json:"developer_id"`
	Status       string  `json:"status"`
	DeployedAt   string  `json:"completed_at"`
	PRID         string  `json:"pr_id"`
	Environment  string  `json:"environment"`
	LeadTimeDays float64 `json:"lead_time_days"`
}

type BugReport struct {
	ID            string `json:"bug_id"`
	LinkedIssueID string `json:"linked_issue_id"`
	DeveloperID   string `json:"developer_id"`
	Severity      string `json:"severity"`
	FoundAt       string `json:"found_at"`
	EscapedToProd string `json:"escaped_to_prod"`
}

// API Response Models

type MetricDetail struct {
	Value          float64 `json:"value"`
	PreviousValue  float64 `json:"previousValue"`
	ChangePercent  float64 `json:"changePercent"`
	TrendDirection string  `json:"trendDirection"` // "improving", "degrading", "stable"
	Display        string  `json:"display"`
	Status         string  `json:"status"` // "Healthy", "Moderate", "Opportunity Area"
	Explanation    string  `json:"explanation"`
	BusinessImpact string  `json:"businessImpact"`
	TeamContext    string  `json:"teamContext"`
}

type HealthScoreData struct {
	Score              int    `json:"score"`
	Status             string `json:"status"`
	Summary            string `json:"summary"`
	StrongestDriver    string `json:"strongestDriver"`
	WeakestContributor string `json:"weakestContributor"`
}

type CoachingData struct {
	Strengths       []string `json:"strengths"`
	OpportunityArea []string `json:"opportunityArea"`
	ActionPlan      []string `json:"actionPlan"`
	IsFallback      bool     `json:"isFallback"`
}

type DashboardResponse struct {
	Developer           Developer               `json:"developer"`
	Metrics             map[string]MetricDetail `json:"metrics"`
	HealthScore         HealthScoreData         `json:"healthScore"`
	CrossMetricAnalysis []string                `json:"crossMetricAnalysis"`
	Coaching            CoachingData            `json:"coaching"`
	Charts              ChartsData              `json:"charts"`
}

type ChartsData struct {
	DeploymentTrend []DataPoint `json:"deploymentTrend"`
	PRTrend         []DataPoint `json:"prTrend"`
	BugTrend        []DataPoint `json:"bugTrend"`
	CycleTimeTrend  []DataPoint `json:"cycleTimeTrend"`
}

type DataPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}
