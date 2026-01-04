import { MedalInfo } from '../types/types'

export function createMedal(medal: MedalInfo) {
  const medalContainer = document.createElement('div')
  medalContainer.className = 'fans-medal-item'
  // Simplified implementation for now
  medalContainer.innerText = `[${medal.medal_name}|${medal.medal_level}]`
  medalContainer.style.color = `#${medal.medal_color.toString(16)}`
  medalContainer.style.border = `1px solid #${medal.medal_color_border.toString(16)}`
  return medalContainer
}
