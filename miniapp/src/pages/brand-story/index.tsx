import { View, Text, Image } from '@tarojs/components'
import story1 from '@/assets/brand/story-1.jpg'
import story2 from '@/assets/brand/story-2.jpg'
import story3 from '@/assets/brand/story-3.jpg'
import './index.scss'
import BrandNavBar from '@/components/BrandNavBar'

/**
 * §BR · 品牌故事 · Brand Story
 * 图文长页 · 大图 + 段落交替, Apple 风纯排版
 */

const CHAPTERS = [
  {
    img: story1,
    kicker: '起点 · ORIGIN',
    title: '一片麦田的约定',
    body:
      '陇上管家始于陇原大地的一片示范麦田。我们相信, 每个人都值得拥有一块属于自己的田——不必离开城市, 也能听见作物拔节的声音。认养一块田, 就是与土地立下一个慢慢兑现的约定。',
  },
  {
    img: story3,
    kicker: '方式 · HOW',
    title: '看得见的生长',
    body:
      '田间的传感器昼夜记录温度、湿度与光照, 摄像头把现场画面送到你的手机。浇水、卷帘、施肥, 每一次作业都有据可查。我们把农事变成一份可以随时翻阅的日志, 让远方的你安心。',
  },
  {
    img: story2,
    kicker: '收获 · HARVEST',
    title: '从田间到餐桌',
    body:
      '当季蔬果成熟, 从采收、分拣到寄出全程溯源。你收到的不只是一份食材, 更是一整季阳光、雨水和耐心的总和。种瓜得瓜, 种豆得豆——这是土地最朴素的承诺, 也是我们的。',
  },
]

export default function BrandStoryPage() {
  return (
    <View className='story-page'>
      <BrandNavBar />
      <View className='story-hero'>
        <Text className='story-hero__en'>LONGARCH</Text>
        <Text className='story-hero__title'>陇上管家</Text>
        <Text className='story-hero__lede'>把一块田, 交到你手上</Text>
      </View>

      {CHAPTERS.map((c) => (
        <View key={c.kicker} className='story-chapter'>
          <Image className='story-chapter__img' src={c.img} mode='aspectFill' />
          <Text className='story-chapter__kicker'>{c.kicker}</Text>
          <Text className='story-chapter__title'>{c.title}</Text>
          <Text className='story-chapter__body'>{c.body}</Text>
        </View>
      ))}

      <View className='story-coda'>
        <Text className='story-coda__quote'>春种一粒粟, 秋收万颗子</Text>
        <Text className='story-coda__source'>陇上示范农场 · 与你同耕</Text>
      </View>
    </View>
  )
}
