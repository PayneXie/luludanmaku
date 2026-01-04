export function renderContent(content: string) {
  const span = document.createElement('span')
  span.className = 'content'
  span.innerText = content
  return span
}
