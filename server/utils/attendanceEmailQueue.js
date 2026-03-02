const AttendanceSubmission = require('../models/AttendanceSubmission');
const { sendAttendanceSubmissionEmail } = require('./emailUtils');
const { increment, observeMs } = require('./attendanceMetrics');

const queue = [];
let processing = false;

function enqueueAttendanceSubmissionEmails({ submissionId, retries = 2 }) {
    if (process.env.ATTENDANCE_DISABLE_EMAIL_QUEUE === 'true') {
        increment('attendance.email.queue.skipped');
        return;
    }
    queue.push({ submissionId, retries });
    increment('attendance.email.queue.enqueued');
    void processQueue();
}

async function processQueue() {
    if (processing) return;
    processing = true;

    while (queue.length > 0) {
        const job = queue.shift();
        try {
            await handleJob(job);
        } catch (error) {
            console.error('Attendance email queue job failed:', error);
        }
    }

    processing = false;
}

async function handleJob(job) {
    const startedAt = Date.now();
    const submission = await AttendanceSubmission.findById(job.submissionId);
    if (!submission) return;

    const recipients = [{ email: submission.attendeeEmail, type: 'attendee' }];
    if (submission.sendAdditionalRecipient && submission.additionalRecipientEmail) {
        recipients.push({ email: submission.additionalRecipientEmail, type: 'additional' });
    }

    let hasAttendeeSuccess = false;
    let hadFailure = false;

    for (const recipient of recipients) {
        const result = await sendAttendanceSubmissionEmail(recipient.email, {
            meetingTopic: submission.meetingTopic,
            meetingDate: submission.meetingDate,
            meetingTimeLabel: submission.meetingTimeLabel,
            meetingIdDisplay: submission.meetingIdDisplay
        });

        const success = Boolean(result?.sent);
        if (!success) hadFailure = true;
        if (recipient.type === 'attendee' && success) hasAttendeeSuccess = true;
        increment(success ? 'attendance.email.sent.success' : 'attendance.email.sent.failure');

        submission.emailLog.push({
            recipient: recipient.email,
            type: recipient.type,
            sentAt: new Date(),
            providerMessageId: null,
            success,
            error: success ? null : (result?.skipped ? 'Email transport not configured' : 'Failed to send')
        });
    }

    if (hasAttendeeSuccess) {
        submission.status = 'emailed';
    } else if (hadFailure) {
        submission.status = 'error';
    }

    await submission.save();

    if (submission.status === 'error' && job.retries > 0) {
        increment('attendance.email.queue.retry');
        queue.push({ submissionId: submission._id.toString(), retries: job.retries - 1 });
    }

    observeMs('attendance.email.queue.job.ms', Date.now() - startedAt);
}

module.exports = {
    enqueueAttendanceSubmissionEmails
};
