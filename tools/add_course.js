const fs = require('fs');
const file = 'c:/Users/ganes/OneDrive/Desktop/Clinch/courses-content.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const newCourse = {
  "id": "saas-devops-production",
  "title": "Production SaaS DevOps Engineering: Multi‑Tenant Real‑Time Systems",
  "category": "DevOps",
  "level": "Professional",
  "duration": "14 Weeks",
  "description": "Learn to design, deploy, and operate production‑grade, multi‑tenant, real‑time SaaS platforms. This course interweaves system architecture, secure CI/CD enforcement, Kubernetes on GKE Autopilot, WebSocket scaling with Redis, database operations (Supabase), secrets management, security pipelines, observability, cost engineering, incident response, Infrastructure as Code, and audit‑ready engineering. You will build the discipline to deliver secure, cost‑optimised, and compliant systems.",
  "modules": [
    {}
  ]
};
const exists = data.courses.find(c => c.id === newCourse.id);
if (!exists) {
    data.courses.push(newCourse);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log('Course added successfully.');
} else {
    console.log('Course already exists.');
}
