/**
 * Example utility function
 * @param {string} name
 * @returns {string}
 */
export const formatGreeting = (name: string): string => {
  return `Hello, ${name}!`
}

/**
 * Class name joiner
 * @param {...string} classes
 * @returns {string}
 */
export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ')
}

export function levelToName(level: number) {
  switch (level) {
    case 1:
      return '总督'
    case 2:
      return '提督'
    case 3:
      return '舰长'
    default:
      return ''
  }
}

export function levelToIconURL(level: number) {
  switch (level) {
    case 1:
      return '/images/level1.jpg' // 总督
    case 2:
      return '/images/level2.png' // 提督
    case 3:
      return '/images/level3.png' // 舰长
    default:
      return ''
  }
}

export function InteractActionToStr(action: number) {
  if (action === 1) {
    return '进入了'
  }
  return '关注了'
}
