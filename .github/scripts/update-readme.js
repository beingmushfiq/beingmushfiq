const fs = require('fs');
const path = require('path');

async function updateReadme() {
  const readmePath = path.resolve(__dirname, '../../README.md');
  if (!fs.existsSync(readmePath)) {
    console.error('README.md not found at', readmePath);
    process.exit(1);
  }

  const token = process.env.GITHUB_TOKEN;
  const headers = {
    'User-Agent': 'GitHub-Profile-Updater'
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const res = await fetch('https://api.github.com/users/beingmushfiq/events/public?per_page=30', { headers });
    if (!res.ok) {
      console.warn(`GitHub API returned status ${res.status}. Preserving existing activity.`);
      return;
    }

    const events = await res.json();
    if (!Array.isArray(events) || events.length === 0) {
      console.log('No public events returned.');
      return;
    }

    // Filter relevant events (PushEvent, ReleaseEvent, CreateEvent)
    const validEvents = [];
    for (const e of events) {
      if (e.type === 'PushEvent' && e.payload && e.payload.commits && e.payload.commits.length > 0) {
        const repoName = e.repo.name.replace('beingmushfiq/', '');
        const commit = e.payload.commits[e.payload.commits.length - 1]; // latest commit in push
        const message = commit.message.split('\n')[0].replace(/\|/g, '-');
        const date = e.created_at.slice(0, 10);
        validEvents.push({
          repo: repoName,
          repoUrl: `https://github.com/${e.repo.name}`,
          type: 'Push / Commit',
          desc: message,
          date
        });
      } else if (e.type === 'ReleaseEvent' && e.payload && e.payload.release) {
        const repoName = e.repo.name.replace('beingmushfiq/', '');
        const releaseName = e.payload.release.name || e.payload.release.tag_name || 'Release';
        const date = e.created_at.slice(0, 10);
        validEvents.push({
          repo: repoName,
          repoUrl: `https://github.com/${e.repo.name}`,
          type: 'Production Release',
          desc: releaseName.replace(/\|/g, '-'),
          date
        });
      }
      if (validEvents.length >= 5) break;
    }

    if (validEvents.length === 0) {
      console.log('No commit or release events to format.');
      return;
    }

    let table = '| System / Repository | Dispatch Type | Description &amp; Commit Narrative | Timestamp |\n';
    table += '| :--- | :--- | :--- | :--- |\n';
    for (const ev of validEvents) {
      table += `| [**${ev.repo}**](${ev.repoUrl}) | \`${ev.type}\` | ${ev.desc} | \`${ev.date}\` |\n`;
    }

    let readme = fs.readFileSync(readmePath, 'utf8');
    const startTag = '<!-- RECENT_ACTIVITY:START -->';
    const endTag = '<!-- RECENT_ACTIVITY:END -->';

    const startIndex = readme.indexOf(startTag);
    const endIndex = readme.indexOf(endTag);

    if (startIndex !== -1 && endIndex !== -1) {
      const newReadme = readme.slice(0, startIndex + startTag.length) +
        '\n' + table +
        readme.slice(endIndex);
      fs.writeFileSync(readmePath, newReadme, 'utf8');
      console.log('Successfully updated RECENT_ACTIVITY in README.md');
    } else {
      console.warn('Marker tags not found in README.md. Skipping injection.');
    }
  } catch (err) {
    console.error('Error updating README activity:', err.message);
  }
}

updateReadme();
