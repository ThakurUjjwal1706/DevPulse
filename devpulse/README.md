# DevPulse · Developer Intelligence Dashboard

![DevPulse Banner](https://img.shields.io/badge/DevPulse-AI--Powered-6366f1?style=for-the-badge)
![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Gemini AI](https://img.shields.io/badge/AI-Gemini%201.5%20Pro-orange?style=for-the-badge)

**DevPulse** is a high-fidelity, AI-driven productivity dashboard designed to provide engineering leaders and developers with deep insights into their workflow. By synthesizing DORA metrics, PR quality, and deployment patterns, DevPulse offers more than just data—it provides empathetic, actionable coaching powered by Google's Gemini AI.

---

## ✨ Key Features

### 📊 DORA-Centric Metrics
Track the four golden signals of software delivery with precision:
- **Cycle Time:** Measure the speed from first commit to production.
- **Deployment Frequency:** Monitor how often value is shipped.
- **Lead Time for Changes:** Identify bottlenecks in the review-to-release pipeline.
- **Change Failure Rate:** Maintain high quality while moving fast.

### 🤖 AI Coaching Engine
Integrated with **Gemini 1.5 Pro**, DevPulse analyzes complex metric relationships to generate:
- **Empathetic Strengths:** Recognizing healthy engineering habits.
- **Workflow Opportunities:** Identifying bottlenecks without punitive language.
- **Action Plans:** Practical, concise steps to improve delivery velocity.

### ⚡ Developer Health Score
A proprietary scoring engine that evaluates:
- Sprint-level output quality.
- Deployment stability (Standard vs. Hotfix ratio).
- PR throughput and review efficiency.
- Cross-metric correlation (e.g., how PR size affects cycle time).

### 🎨 Premium UI/UX
- **Modern Aesthetic:** Inspired by Linear and Stripe, featuring a sophisticated dark-mode design system.
- **Interactive Visualizations:** Custom SVG-based health arcs and status indicators.
- **Responsive Layout:** Modular architecture supporting both Individual and Team-level intelligence.

---

## 🏗️ Architecture

DevPulse follows a clean, decoupled architecture:

- **Backend (Go):** A high-performance Gin-based REST API that handles data orchestration, metric calculation, and AI integration.
- **Frontend (Vanilla HTML/JS):** A zero-dependency, ultra-fast frontend utilizing CSS variables for a robust design system and high-fidelity animations.
- **AI Layer:** Utilizes the Google Generative AI SDK to perform semantic analysis of engineering data.

---

## 🚀 Getting Started

### Prerequisites
- [Go](https://golang.org/doc/install) 1.21+
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 1. Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
go mod tidy

# Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env

# Run the server
go run main.go
```
The backend will be available at `http://localhost:8080`.

### 2. Frontend Setup
The frontend is built with pure HTML/JS/CSS and requires no build step. Simply serve the `frontend` directory using any static file server (e.g., Live Server in VS Code or `python -m http.server`).

```bash
# Example using Python
cd frontend
python -m http.server 3000
```
Open `http://localhost:3000` in your browser.

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/developers` | `GET` | Returns a list of all engineers in the system. |
| `/api/dashboard/:id` | `GET` | Returns full metrics, health score, and AI coaching for a specific dev. |

---

## 📂 Project Structure

```text
devpulse/
├── backend/
│   ├── data/           # Mock JSON data (Jira, GitHub, Deployments)
│   ├── handlers/       # Gin request handlers
│   ├── models/         # Go structs for domain entities
│   ├── services/       # Core logic (AI, Metric calculations)
│   └── routes/         # API routing
└── frontend/
    ├── style.css       # Premium CSS design system
    ├── app.js          # Core frontend logic & orchestration
    └── index.html      # Main dashboard structure
```

---

## 🛠️ Tech Stack
- **Languages:** Go, JavaScript (ES6+), HTML5, CSS3
- **Backend Framework:** Gin Gonic
- **AI:** Google Gemini 1.5 Pro
- **Data Format:** JSON-based data ingestion
- **Styling:** Vanilla CSS (Custom tokens, Glassmorphism)

---

## 🤝 Contributing
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for High-Performance Teams.
</p>
