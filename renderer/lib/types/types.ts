export interface MergeUserInfo {
  index: number
  // Add other properties as needed
}

export interface DmExtraInfo {
  show_reply: boolean
  reply_uname: string
  // Add other properties as needed
}

export interface EmojiContent {
  url: string
  width: number
  height: number
  // Add other properties as needed
}

export class MedalInfo {
  anchor_roomid: number = 0
  anchor_uname: string = ''
  medal_name: string = ''
  medal_level: number = 0
  medal_color: number = 0
  medal_color_border: number = 0
  medal_color_start: number = 0
  medal_color_end: number = 0
  guard_level: number = 0
  is_lighted: number = 0
}

export class Sender {
  uid: number = 0
  uname: string = ''
  face: string = ''
  medal_info: MedalInfo = new MedalInfo()
}
