const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const examFile = path.join(__dirname, '..', 'examquestions.json');

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function run() {
  console.log('\n=== ClinchWorks Exam Init ===\n');

  let data = {};
  if (fs.existsSync(examFile)) {
    data = JSON.parse(fs.readFileSync(examFile, 'utf8'));
  }

  const courseId = await ask('Course ID (e.g. secure-cloud-architecture): ');
  if (!courseId) {
    console.log('Course ID is required.');
    rl.close();
    return;
  }

  if (data[courseId]) {
    console.log(`\n[!] Exam questions for '${courseId}' already exist.`);
    rl.close();
    return;
  }

  data[courseId] = [
    {
      "id": "q1",
      "text": "Sample Question 1?",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "correct": 0
    }
  ];

  fs.writeFileSync(examFile, JSON.stringify(data, null, 2));

  console.log(`\n[+] Exam template for '${courseId}' added successfully!`);
  console.log(`You can now manually add questions to examquestions.json for this course.`);
  
  rl.close();
}

run();
