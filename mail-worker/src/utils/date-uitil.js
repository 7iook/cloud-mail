import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(utc)
dayjs.extend(timezone)

export function formatDetailDate(time) {
	// 使用 UTC 格式化，确保时间不会因为本地时区而改变
	return dayjs.utc(time).format('YYYY-MM-DD HH:mm:ss')
}

export function toUtc(time) {
	return dayjs.utc(time || dayjs())
}
