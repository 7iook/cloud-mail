import http from '@/axios/index.js';

export function settingSet(setting) {
    return http.put('/setting/set',setting)
}

export function settingQuery() {
    return http.get('/setting/query')
}

export function websiteConfig() {
    return http.get('/setting/websiteConfig')
}

export function setBackground(background) {
    return http.put('/setting/setBackground',{background})
}

export function physicsDeleteAll() {
    return http.delete('/setting/physicsDeleteAll')
}

export function getGlobalAnnouncement() {
    return http.get('/setting/global-announcement')
}

export function setGlobalAnnouncement(data) {
    return http.put('/setting/global-announcement', data)
}

export function markAnnouncementAsRead(userId, announcementVersion) {
    return http.post('/setting/announcement/mark-read', { userId, announcementVersion })
}

export function checkAnnouncementRead(userId, announcementVersion) {
    return http.get('/setting/announcement/check-read', { params: { userId, announcementVersion } })
}