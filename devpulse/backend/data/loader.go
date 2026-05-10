package data

import (
	"encoding/json"
	"io/ioutil"
	"os"

	"devpulse-backend/models"
)

var (
	Developers   []models.Developer
	JiraIssues   []models.JiraIssue
	PullRequests []models.PullRequest
	Deployments  []models.Deployment
	BugReports   []models.BugReport
)

func loadJSON(filename string, v interface{}) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()
	bytes, err := ioutil.ReadAll(file)
	if err != nil {
		return err
	}
	return json.Unmarshal(bytes, v)
}

func LoadAllData() error {
	if err := loadJSON("data/developers.json", &Developers); err != nil {
		return err
	}
	if err := loadJSON("data/jira_issues.json", &JiraIssues); err != nil {
		return err
	}
	if err := loadJSON("data/pull_requests.json", &PullRequests); err != nil {
		return err
	}
	if err := loadJSON("data/deployments.json", &Deployments); err != nil {
		return err
	}
	if err := loadJSON("data/bug_reports.json", &BugReports); err != nil {
		return err
	}
	return nil
}
