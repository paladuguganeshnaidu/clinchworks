const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const contentFile = path.join(__dirname, '..', 'courses-content.json');

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function run() {
  console.log('\n=== ClinchWorks Course Init ===\n');

  let data = { courses: [] };
  if (fs.existsSync(contentFile)) {
    data = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  }

  const id = await ask('Course ID (e.g. secure-cloud-architecture): ');
  if (!id) {
    console.log('ID is required.');
    rl.close();
    return;
  }

  if (data.courses.some(c => c.id === id)) {
    console.log(`\n[!] Course with ID '${id}' already exists.`);
    rl.close();
    return;
  }

  const title = await ask('Title: ');
  const category = await ask('Category (e.g. Cloud, Cybersecurity, Programming): ');
  const level = await ask('Level (e.g. Beginner, Professional): ');
  const duration = await ask('Duration (e.g. 10 Weeks): ');
  const description = await ask('Description: ');

  const newCourse = {
    id: id.trim(),
    title: title.trim(),
    category: category.trim(),
    level: level.trim(),
    duration: duration.trim(),
    description: description.trim(),
    modules: [
      {
        "id": "module-1",
        "title": "Module 1 Title",
        "videos": [
          {
            "id": "vid-1",
            "title": "Introduction",
            "driveId": "YOUR_DRIVE_VIDEO_ID_HERE"
          }
        ],
        "materials": []
      }
    ]
  };

  data.courses.push(newCourse);
  fs.writeFileSync(contentFile, JSON.stringify(data, null, 2));

  console.log(`\n[+] Course '${id}' added successfully!`);
  console.log(`You can now manually add modules/videos to courses-content.json for this course.`);
  
  rl.close();
}

run();
