import { renderContent } from './content-render'
import { createMedal } from './medal'
import {
  EntryEffectMessage,
  GiftMessage,
  GuardMessage,
  InteractMessage,
} from '../types/danmaku'
import { EmojiContent, MedalInfo, Sender } from '../types/types'
import { levelToIconURL, levelToName } from '../utils'

export function createDanmuEntry(
  side_index: number,
  special: boolean,
  medal: MedalInfo,
  sender: Sender,
  content: string,
  emoji_content: EmojiContent,
  reply_uname: string = null
) {
  const danmuEntry = document.createElement('div') // Changed to div for block display in simple list
  if (special) {
    danmuEntry.className = 'danmu_entry special'
  } else {
    danmuEntry.className = 'danmu_entry'
  }

  if (side_index >= 0) {
    danmuEntry.classList.add('side' + side_index)
  }

  // might be gray medal, need to check color
  if (medal && medal.is_lighted) {
    danmuEntry.appendChild(createMedal(medal))
  }
  const danmuSender = document.createElement('span')
  danmuSender.className = 'sender'
  danmuSender.style.color = '#00a1d6'
  danmuSender.style.fontWeight = 'bold'
  danmuSender.style.marginRight = '8px'
  if (content) sender.uname = sender.uname + '：'
  danmuSender.innerText = sender.uname
  danmuEntry.appendChild(danmuSender)
  if (content) {
    if (emoji_content) {
      const danmuContent = document.createElement('span')
      const ratio = emoji_content.width / emoji_content.height
      danmuContent.className = 'content emoji'
      danmuContent.style.backgroundImage = `url(${emoji_content.url})`
      danmuContent.style.width = `calc((var(--danmu-size) + 32px) * ${ratio})`
      danmuContent.style.height = 'calc(var(--danmu-size) + 32px)'
      danmuEntry.appendChild(danmuContent)
    } else {
      if (reply_uname && reply_uname != '') {
        const danmuContent = document.createElement('span')
        danmuContent.className = 'content reply'
        danmuContent.innerText = `@${reply_uname}`
        danmuEntry.appendChild(danmuContent)
      }
      danmuEntry.appendChild(renderContent(content))
    }
  }

  return danmuEntry
}

export function createInteractEntry(msg: InteractMessage) {
  return doCreateInteractEntry(msg)
}

function doCreateInteractEntry(msg: InteractMessage) {
  const danmuEntry = document.createElement('div')
  danmuEntry.className = 'danmu_entry interact'
  const danmuSender = document.createElement('span')
  danmuSender.className = 'sender'
  danmuSender.innerText = msg.sender.uname
  danmuEntry.appendChild(danmuSender)
  // Content
  const danmuContent = document.createElement('span')
  danmuContent.className = 'content'
  if (msg.action == 2) {
    danmuContent.innerText = ' 关注了直播间'
  } else {
    danmuContent.innerText = ' 进入了直播间'
  }
  danmuContent.style.marginLeft = '8px'
  danmuContent.style.color = '#aaa'
  danmuEntry.appendChild(danmuContent)
  return danmuEntry
}
