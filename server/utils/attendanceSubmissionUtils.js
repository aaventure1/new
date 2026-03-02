const crypto = require('crypto');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeDateOnlyUTC(dateString) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function sanitizeText(value, maxLen) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, maxLen);
}

function normalizeTopicKey(topic) {
    return sanitizeText(topic, 200).toLowerCase();
}

function isValidEmail(email) {
    return EMAIL_REGEX.test(String(email || '').trim().toLowerCase());
}

function buildSubmissionKey({ userId, meetingDate, meetingTime, meetingTopic }) {
    return `${userId}:${meetingDate}:${sanitizeText(meetingTime, 40)}:${normalizeTopicKey(meetingTopic)}`;
}

function maskName(name) {
    const parts = sanitizeText(name, 120).split(' ').filter(Boolean);
    if (parts.length === 0) return 'Unknown';
    return parts.map((part) => `${part.charAt(0).toUpperCase()}***`).join(' ');
}

function buildMeetingIdDisplay(userId, secret, isoDay) {
    const raw = `${userId}:${isoDay}:${secret || 'aaventure-default'}`;
    return crypto.createHash('sha256').update(raw).digest('base64url').slice(0, 24);
}

function parseCheckInAt(meetingDate, meetingTimeLabel) {
    const merged = new Date(`${meetingDate} ${meetingTimeLabel}`);
    if (!Number.isNaN(merged.getTime())) return merged;

    const fallback = new Date(`${meetingDate}T12:00:00.000Z`);
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

function buildValidationErrors(payload) {
    const errors = {};

    if (!sanitizeText(payload.fullName, 120)) errors.attendeeFullName = 'The field is required.';
    if (!isValidEmail(payload.email)) errors.attendeeEmail = 'The field is required.';
    if (!payload.sendAdditionalRecipient) errors.extraRecipientChoice = 'The field is required.';
    if (!sanitizeText(payload.meetingDate, 10)) errors.meetingDateInput = 'The field is required.';
    if (!sanitizeText(payload.meetingTime, 40)) errors.meetingTimeInput = 'The field is required.';
    if (!sanitizeText(payload.meetingTopic, 200)) errors.meetingTopicInput = 'The field is required.';
    if (!sanitizeText(payload.meetingChairperson, 120)) errors.meetingChairpersonInput = 'The field is required.';
    if (!sanitizeText(payload.participationInfo, 1000)) errors.participationInfoInput = 'The field is required.';

    const extra = String(payload.sendAdditionalRecipient).toLowerCase();
    if ((extra === 'yes' || extra === 'true') && !isValidEmail(payload.additionalRecipientEmail)) {
        errors.extraRecipientEmail = 'The field is required.';
    }

    return errors;
}

module.exports = {
    normalizeDateOnlyUTC,
    sanitizeText,
    normalizeTopicKey,
    isValidEmail,
    buildSubmissionKey,
    maskName,
    buildMeetingIdDisplay,
    parseCheckInAt,
    buildValidationErrors
};
