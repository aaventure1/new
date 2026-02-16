const nodemailer = require('nodemailer');

const isPlaceholderValue = (value = '') => {
    const lower = String(value).toLowerCase();
    return !lower
        || lower.includes('placeholder')
        || lower.includes('your-email')
        || lower.includes('your_email');
};

const emailEnabled = process.env.EMAIL_ENABLED !== 'false'
    && !isPlaceholderValue(process.env.EMAIL_USER)
    && !isPlaceholderValue(process.env.EMAIL_PASS);

const transporter = emailEnabled
    ? nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
        port: Number(process.env.EMAIL_PORT || 587),
        secure: String(process.env.EMAIL_PORT || '587') === '465',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    })
    : null;

if (!emailEnabled) {
    console.log('ℹ️ Email delivery disabled (EMAIL_USER/EMAIL_PASS not configured).');
}

const sendMailIfConfigured = async (mailOptions, label) => {
    if (!transporter) return { sent: false, skipped: true };
    try {
        await transporter.sendMail(mailOptions);
        return { sent: true, skipped: false };
    } catch (error) {
        console.error(`Email send failed (${label}):`, error.code || error.message);
        return { sent: false, skipped: false };
    }
};

/**
 * Send a welcome email to a new user
 * @param {string} email - Recipient email
 * @param {string} username - User's name
 */
const sendWelcomeEmail = async (email, username) => {
    const mailOptions = {
        from: `"AAVenture Team" <${process.env.EMAIL_FROM || 'noreply@aaventure.com'}>`,
        to: email,
        subject: 'Welcome to AAVenture - Your Recovery Journey Begins!',
        html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
                <h1 style="color: #6366f1;">Welcome to AAVenture!</h1>
                <p>Hello ${username},</p>
                <p>Thank you for joining our community. We are excited to support you on your recovery journey.</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0;">
                    <h3>Quick Tips to Get Started:</h3>
                    <ul>
                        <li><strong>Join a Meeting:</strong> Check our calendar for live video sessions.</li>
                        <li><strong>Chat Anytime:</strong> Enter our 24/7 rooms for instant fellowship.</li>
                        <li><strong>Get Proof of Attendance:</strong> Subscribe to generate court-ordered certificates.</li>
                    </ul>
                </div>
                <p>If you have any questions, simply reply to this email.</p>
                <p>Recovery Together,<br>The AAVenture Team</p>
            </div>
        `
    };

    const result = await sendMailIfConfigured(mailOptions, 'welcome');
    if (result.sent) {
        console.log(`✅ Welcome email sent to ${email}`);
    }
};

/**
 * Send a certificate notification email
 * @param {string} email - Recipient email
 * @param {Object} certificateDetails - Details for the email
 */
const sendCertificateEmail = async (email, details) => {
    const mailOptions = {
        from: `"AAVenture Proof" <${process.env.EMAIL_FROM || 'noreply@aaventure.com'}>`,
        to: email,
        subject: `Your Proof of Attendance: ${details.meetingTitle}`,
        html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
                <h1 style="color: #10b981;">Certificate Generated!</h1>
                <p>Hello,</p>
                <p>Your proof of attendance certificate for the meeting <strong>"${details.meetingTitle}"</strong> is now ready.</p>
                <div style="background: #f0fdfa; padding: 20px; border-radius: 12px; border: 1px solid #10b981; margin: 20px 0; text-align: center;">
                    <p style="font-size: 0.9rem; color: #065f46; margin-bottom: 5px;">Certificate ID</p>
                    <p style="font-size: 1.2rem; font-weight: bold; margin: 0;">${details.certificateId}</p>
                    <a href="${process.env.BASE_URL || 'http://localhost:3000'}/api/attendance/download/${details.certificateId}" 
                       style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Download Certificate (PDF)
                    </a>
                </div>
                <p>Verified attendance: ${Math.round(details.duration / 60)} minutes</p>
                <p>Thank you for participating in our community.</p>
            </div>
        `
    };

    const result = await sendMailIfConfigured(mailOptions, 'certificate');
    if (result.sent) {
        console.log(`✅ Certificate email sent to ${email}`);
    }
};

module.exports = {
    sendWelcomeEmail,
    sendCertificateEmail
};
