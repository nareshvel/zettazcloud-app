// A simplified version of the application to verify basic rendering
// This file will be loaded directly from HTML, bypassing the React build system

function SimplifiedApp() {
  // Create basic elements
  const app = document.createElement('div');
  app.style.padding = '20px';
  app.style.fontFamily = 'Arial, sans-serif';
  app.style.backgroundColor = '#f5f5f5';
  app.style.minHeight = '100vh';

  const header = document.createElement('h1');
  header.textContent = 'Zettaz Cloud POS - Simplified Test';
  header.style.color = '#333';
  header.style.marginBottom = '20px';

  const card = document.createElement('div');
  card.style.backgroundColor = 'white';
  card.style.padding = '20px';
  card.style.borderRadius = '5px';
  card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

  const title = document.createElement('h2');
  title.textContent = 'System Diagnostic';
  title.style.marginBottom = '15px';

  const message = document.createElement('p');
  message.textContent = 'This is a simplified version of the application to verify basic rendering.';
  message.style.marginBottom = '15px';

  const envInfo = document.createElement('div');
  envInfo.style.backgroundColor = '#e8f4ff';
  envInfo.style.padding = '15px';
  envInfo.style.borderRadius = '4px';
  envInfo.style.marginBottom = '20px';
  
  const envTitle = document.createElement('h3');
  envTitle.textContent = 'Environment Information';
  envTitle.style.marginTop = '0';
  
  const envList = document.createElement('ul');
  
  // Create environment info items
  const items = [
    `URL: ${window.location.href}`,
    `User Agent: ${navigator.userAgent}`,
    `Screen Size: ${window.innerWidth}x${window.innerHeight}`,
    `Date/Time: ${new Date().toLocaleString()}`
  ];
  
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    li.style.marginBottom = '5px';
    envList.appendChild(li);
  });
  
  // Create button to test interactivity
  const button = document.createElement('button');
  button.textContent = 'Test Button';
  button.style.backgroundColor = '#4CAF50';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.padding = '10px 15px';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  button.onclick = () => {
    alert('Button clicked! JavaScript is working correctly.');
  };
  
  // Create link back to main app
  const backLink = document.createElement('a');
  backLink.href = '/';
  backLink.textContent = 'Go back to main application';
  backLink.style.display = 'block';
  backLink.style.marginTop = '20px';
  backLink.style.color = '#0066cc';
  
  // Assemble the UI
  envInfo.appendChild(envTitle);
  envInfo.appendChild(envList);
  
  card.appendChild(title);
  card.appendChild(message);
  card.appendChild(envInfo);
  card.appendChild(button);
  card.appendChild(backLink);
  
  app.appendChild(header);
  app.appendChild(card);
  
  return app;
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Clear any existing content
  document.body.innerHTML = '';
  
  // Add our simplified app
  document.body.appendChild(SimplifiedApp());
  
  console.log('Simplified app rendered successfully!');
});
