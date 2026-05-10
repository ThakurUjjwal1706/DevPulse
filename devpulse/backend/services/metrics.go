package services

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"devpulse-backend/data"
	"devpulse-backend/models"
)

func RunProductivityEngine(devID string) (map[string]models.MetricDetail, models.HealthScoreData, []string) {
	metrics := calculateRawMetrics(devID)
	metricDetails := classifyMetrics(metrics)
	healthScore := calculateHealthScore(metricDetails)
	crossAnalysis := generateCrossMetricAnalysis(metricDetails)

	return metricDetails, healthScore, crossAnalysis
}

type rawMetrics struct {
	LeadTimeDays        float64
	CycleTimeDays       float64
	BugRatePercentage   float64
	DeploymentFrequency float64
	PRThroughput        float64
}

func calculateRawMetrics(devID string) rawMetrics {
	var m rawMetrics

	for _, pr := range data.PullRequests {
		if pr.DeveloperID == devID && pr.Status == "merged" {
			m.PRThroughput++
		}
	}

	var leadTimeTotalDays float64
	var leadTimeCount int
	for _, dep := range data.Deployments {
		if dep.DeveloperID == devID && dep.Status == "success" && dep.Environment == "prod" {
			m.DeploymentFrequency++
			leadTimeTotalDays += dep.LeadTimeDays
			leadTimeCount++
		}
	}
	if leadTimeCount > 0 {
		m.LeadTimeDays = math.Round((leadTimeTotalDays/float64(leadTimeCount))*10) / 10
	}

	var cycleTimeTotalDays float64
	var cycleTimeCount int
	var completedIssues int
	for _, issue := range data.JiraIssues {
		if issue.DeveloperID == devID && issue.Status == "Done" {
			completedIssues++
			cycleTimeTotalDays += issue.CycleTimeDays
			cycleTimeCount++
		}
	}
	if cycleTimeCount > 0 {
		m.CycleTimeDays = math.Round((cycleTimeTotalDays/float64(cycleTimeCount))*10) / 10
	}

	var escapedBugs int
	for _, bug := range data.BugReports {
		if bug.DeveloperID == devID && bug.EscapedToProd == "Yes" {
			escapedBugs++
		}
	}
	if completedIssues > 0 {
		m.BugRatePercentage = math.Round((float64(escapedBugs)/float64(completedIssues))*100*10) / 10
	}

	return m
}

// computeTrend calculates mock historical progression for MVP purposes
func computeTrend(current float64, inverted bool) (float64, float64, string) {
	rand.Seed(time.Now().UnixNano() + int64(current*100)) // Deterministic-ish randomness
	variance := 0.8 + rand.Float64()*0.4 // 0.8 to 1.2 multiplier for previous
	previous := math.Round(current * variance * 10) / 10
	
	if previous == 0 {
		previous = 1 // avoid div by zero
	}
	
	change := math.Round(((current - previous) / previous) * 100)
	
	var dir string
	if change == 0 {
		dir = "stable"
	} else if (change < 0 && inverted) || (change > 0 && !inverted) {
		dir = "improving"
	} else {
		dir = "degrading"
	}
	
	return previous, change, dir
}

func classifyMetrics(m rawMetrics) map[string]models.MetricDetail {
	details := make(map[string]models.MetricDetail)

	// Cycle Time
	ctPrev, ctChg, ctDir := computeTrend(m.CycleTimeDays, true) // lower is better
	ct := models.MetricDetail{
		Value: m.CycleTimeDays, PreviousValue: ctPrev, ChangePercent: ctChg, TrendDirection: ctDir,
		Display: fmt.Sprintf("%.1f days", m.CycleTimeDays),
		BusinessImpact: "Elevated cycle time may slow feature delivery and reduce responsiveness to product changes.",
		TeamContext: "Cycle time is slightly above the team average baseline.",
	}
	if m.CycleTimeDays <= 4 {
		ct.Status = "Healthy"
		ct.Explanation = "Tasks are moving efficiently from In Progress to Done."
		ct.TeamContext = "Cycle Time is highly competitive compared to team norms."
	} else if m.CycleTimeDays <= 7 {
		ct.Status = "Moderate"
		ct.Explanation = "Acceptable pace, but scope of tasks might be large."
	} else {
		ct.Status = "Opportunity Area"
		ct.Explanation = "Tasks stay in progress too long; consider breaking them down."
	}
	details["cycleTime"] = ct

	// Lead Time
	ltPrev, ltChg, ltDir := computeTrend(m.LeadTimeDays, true)
	lt := models.MetricDetail{
		Value: m.LeadTimeDays, PreviousValue: ltPrev, ChangePercent: ltChg, TrendDirection: ltDir,
		Display: fmt.Sprintf("%.1f days", m.LeadTimeDays),
		BusinessImpact: "Long lead times delay value realization and increase merge conflict risk.",
		TeamContext: "Lead time aligns well with current team CI/CD performance.",
	}
	if m.LeadTimeDays <= 2 {
		lt.Status = "Healthy"
		lt.Explanation = "Fast delivery from PR creation to production."
	} else if m.LeadTimeDays <= 5 {
		lt.Status = "Moderate"
		lt.Explanation = "Average delivery speed; minor delays in review or staging."
	} else {
		lt.Status = "Opportunity Area"
		lt.Explanation = "Code is taking too long to reach production post-PR."
	}
	details["leadTime"] = lt

	// Bug Rate
	brPrev, brChg, brDir := computeTrend(m.BugRatePercentage, true)
	br := models.MetricDetail{
		Value: m.BugRatePercentage, PreviousValue: brPrev, ChangePercent: brChg, TrendDirection: brDir,
		Display: fmt.Sprintf("%.1f%%", m.BugRatePercentage),
		BusinessImpact: "High escaped bug rates compromise system reliability and erode user trust.",
		TeamContext: "Bug escape rate is stable relative to team standards.",
	}
	if m.BugRatePercentage <= 5 {
		br.Status = "Healthy"
		br.Explanation = "High quality delivery with minimal escaped bugs."
	} else if m.BugRatePercentage <= 15 {
		br.Status = "Moderate"
		br.Explanation = "Noticeable bug rate; consider reinforcing regression tests."
	} else {
		br.Status = "Opportunity Area"
		br.Explanation = "High defect escape rate impacting production reliability."
	}
	details["bugRate"] = br

	// Deployment Frequency
	dfPrev, dfChg, dfDir := computeTrend(m.DeploymentFrequency, false) // higher is better
	df := models.MetricDetail{
		Value: m.DeploymentFrequency, PreviousValue: dfPrev, ChangePercent: dfChg, TrendDirection: dfDir,
		Display: fmt.Sprintf("%.0f deploys", m.DeploymentFrequency),
		BusinessImpact: "Healthy deployment cadence supports faster iteration and minimizes release anxiety.",
		TeamContext: "Deployment frequency is strong relative to average contributor baseline.",
	}
	if m.DeploymentFrequency >= 4 {
		df.Status = "Healthy"
		df.Explanation = "Excellent continuous delivery habits."
	} else if m.DeploymentFrequency >= 2 {
		df.Status = "Moderate"
		df.Explanation = "Steady deployment rhythm."
	} else {
		df.Status = "Opportunity Area"
		df.Explanation = "Infrequent deployments increase release risk."
	}
	details["deploymentFreq"] = df

	// PR Throughput
	prPrev, prChg, prDir := computeTrend(m.PRThroughput, false)
	pr := models.MetricDetail{
		Value: m.PRThroughput, PreviousValue: prPrev, ChangePercent: prChg, TrendDirection: prDir,
		Display: fmt.Sprintf("%.0f PRs", m.PRThroughput),
		BusinessImpact: "Consistent throughput ensures steady team velocity and avoids deep integration bottlenecks.",
		TeamContext: "PR throughput is well-distributed compared to peer averages.",
	}
	if m.PRThroughput >= 5 {
		pr.Status = "Healthy"
		pr.Explanation = "Strong, continuous flow of code integration."
	} else if m.PRThroughput >= 2 {
		pr.Status = "Moderate"
		pr.Explanation = "Consistent but lower volume of integrations."
	} else {
		pr.Status = "Opportunity Area"
		pr.Explanation = "Low integration volume; work might be siloed."
	}
	details["prThroughput"] = pr

	return details
}

func calculateHealthScore(details map[string]models.MetricDetail) models.HealthScoreData {
	score := 100
	
	deductions := map[string]int{
		"Healthy":         0,
		"Moderate":        5,
		"Opportunity Area": 15,
	}

	strongest := "Consistency"
	weakest := "None"
	highestPenalty := -1

	for name, metric := range details {
		penalty := deductions[metric.Status]
		score -= penalty
		if penalty == 0 {
			strongest = name
		}
		if penalty > highestPenalty {
			highestPenalty = penalty
			if penalty > 0 {
				weakest = name
			}
		}
	}

	if score < 0 { score = 0 }

	humanNames := map[string]string{
		"cycleTime": "Cycle Time", "leadTime": "Lead Time", "bugRate": "Quality", 
		"deploymentFreq": "Deploy Cadence", "prThroughput": "PR Throughput", "None": "None", "Consistency": "General Flow",
	}

	var status, summary string
	if score >= 85 {
		status = "Healthy"
		summary = fmt.Sprintf("Health score is strong. It is positively driven by %s, indicating sustainable engineering practices.", humanNames[strongest])
	} else if score >= 70 {
		status = "Moderate"
		summary = fmt.Sprintf("Productivity is stable, though optimizing %s could lift overall workflow health.", humanNames[weakest])
	} else {
		status = "Opportunity Area"
		summary = fmt.Sprintf("Health score reduced primarily due to friction in %s. Actionable coaching is recommended to resolve this bottleneck.", humanNames[weakest])
	}

	return models.HealthScoreData{
		Score:              score,
		Status:             status,
		Summary:            summary,
		StrongestDriver:    humanNames[strongest],
		WeakestContributor: humanNames[weakest],
	}
}

func generateCrossMetricAnalysis(details map[string]models.MetricDetail) []string {
	var insights []string

	br := details["bugRate"]
	df := details["deploymentFreq"]
	ct := details["cycleTime"]
	lt := details["leadTime"]
	pr := details["prThroughput"]

	if br.Status == "Opportunity Area" && df.Status == "Opportunity Area" {
		insights = append(insights, "Bug rate is high while deployment frequency is low, suggesting quality concerns may be heavily slowing release confidence.")
	} else if br.Status == "Opportunity Area" && df.Status == "Healthy" {
		insights = append(insights, "High deployment frequency paired with a high bug rate indicates rapid delivery that sacrifices quality. Regression testing is urgently needed.")
	} else if br.Status == "Healthy" && df.Status == "Healthy" {
		insights = append(insights, "Excellent balance of speed and stability: maintaining high deployment frequency without compromising production quality.")
	}

	if ct.Status == "Opportunity Area" && pr.Status == "Opportunity Area" {
		insights = append(insights, "Elevated cycle time and low PR throughput indicate significant bottlenecks in development, possibly due to oversized work items or blocking dependencies.")
	} else if ct.Status == "Healthy" && pr.Status == "Opportunity Area" {
		insights = append(insights, "Tasks are completed quickly, but PR throughput is low. The developer might be working on fewer, highly complex tasks or experiencing delays before PR creation.")
	}

	if lt.Status == "Opportunity Area" && pr.Status == "Healthy" {
		insights = append(insights, "Strong PR throughput but elevated lead time suggests code is being written quickly but stalling in the review, QA, or deployment pipeline.")
	}

	if len(insights) == 0 {
		insights = append(insights, "Metrics indicate a generally balanced workflow without extreme conflicting signals.")
	}

	return insights
}

// GetCharts with annotated data
func GetCharts(devID string) models.ChartsData {
	return models.ChartsData{
		DeploymentTrend: []models.DataPoint{
			{Date: "Sprint 1", Value: 1}, {Date: "Sprint 2", Value: 2}, {Date: "Sprint 3", Value: 1}, {Date: "Sprint 4", Value: 3},
		},
		PRTrend: []models.DataPoint{
			{Date: "Sprint 1", Value: 2}, {Date: "Sprint 2", Value: 4}, {Date: "Sprint 3", Value: 3}, {Date: "Sprint 4", Value: 5},
		},
		BugTrend: []models.DataPoint{
			{Date: "Sprint 1", Value: 1}, {Date: "Sprint 2", Value: 0}, {Date: "Sprint 3", Value: 2}, {Date: "Sprint 4", Value: 1},
		},
		CycleTimeTrend: []models.DataPoint{
			{Date: "Sprint 1", Value: 4.5}, {Date: "Sprint 2", Value: 4.0}, {Date: "Sprint 3", Value: 3.5}, {Date: "Sprint 4", Value: 3.2},
		},
	}
}
