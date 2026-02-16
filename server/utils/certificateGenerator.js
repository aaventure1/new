const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class CertificateGenerator {
    static async generateAttendanceCertificate(attendanceData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'LETTER',
                    layout: 'landscape',
                    margins: { top: 40, bottom: 40, left: 40, right: 40 }
                });

                const certDir = path.join(__dirname, '../../public/certificates');
                if (!fs.existsSync(certDir)) {
                    fs.mkdirSync(certDir, { recursive: true });
                }

                const filename = `certificate_${attendanceData.certificateId}.pdf`;
                const filepath = path.join(certDir, filename);
                const stream = fs.createWriteStream(filepath);

                doc.pipe(stream);

                // --- Background & Border ---
                // Outer Border
                doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
                    .lineWidth(2)
                    .strokeColor('#0f172a')
                    .stroke();

                // Inner Decorative Border
                doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
                    .lineWidth(1)
                    .strokeColor('#6366f1')
                    .stroke();

                // --- Header Section ---
                doc.moveDown(4);
                doc.fillColor('#0f172a')
                    .fontSize(38)
                    .font('Helvetica-Bold')
                    .text('AAVENTURE', { align: 'center', characterSpacing: 2 });

                doc.fontSize(12)
                    .font('Helvetica')
                    .fillColor('#64748b')
                    .text('RECOVERY TOGETHER • ONLINE SUPPORT NETWORK', { align: 'center', characterSpacing: 1 })
                    .moveDown(2);

                doc.fillColor('#0f172a')
                    .fontSize(28)
                    .font('Times-Roman') // More traditional/official feel
                    .text('Certificate of Attendance', { align: 'center' })
                    .moveDown(1.5);

                // --- Content ---
                doc.fontSize(14)
                    .font('Helvetica')
                    .text('This official document serves as proof that', { align: 'center' })
                    .moveDown(0.8);

                doc.fontSize(24)
                    .font('Helvetica-Bold')
                    .fillColor('#4f46e5')
                    .text(attendanceData.userName.toUpperCase(), { align: 'center' })
                    .moveDown(0.8);

                doc.fillColor('#0f172a')
                    .fontSize(14)
                    .font('Helvetica')
                    .text('has successfully attended and participated in the following recovery session:', { align: 'center' })
                    .moveDown(1.5);

                // --- Meeting Table ---
                const centerX = doc.page.width / 2;
                const tableWidth = 500;
                const startX = centerX - tableWidth / 2;
                const startY = doc.y;

                doc.rect(startX, startY, tableWidth, 100)
                    .fillAndStroke('#f8fafc', '#e2e8f0');

                doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11);
                doc.text('MEETING TITLE:', startX + 20, startY + 20);
                doc.text('FORMAT:', startX + 20, startY + 40);
                doc.text('DATE:', startX + 20, startY + 60);
                doc.text('DURATION:', startX + 20, startY + 80);

                doc.font('Helvetica').fillColor('#1e293b');
                doc.text(`${attendanceData.meetingTitle} (${attendanceData.meetingType})`, startX + 130, startY + 20);
                doc.text('Online Interactive Room', startX + 130, startY + 40);
                doc.text(`${new Date(attendanceData.joinTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, startX + 130, startY + 60);
                doc.text(`${Math.round(attendanceData.duration / 60)} Minutes (Verified Active Participation)`, startX + 130, startY + 80);

                // --- Verification Footer ---
                doc.moveDown(6);

                const footerY = doc.y;

                // Left Side: Signature
                doc.moveTo(startX, footerY)
                    .lineTo(startX + 180, footerY)
                    .strokeColor('#94a3b8')
                    .stroke();

                doc.fillColor('#64748b').fontSize(9).font('Helvetica');
                doc.text('ELECTRONICALLY VERIFIED SIGNATURE', startX, footerY + 5);
                doc.text('AAVenture Facilitator Network', startX, footerY + 18);

                // Right Side: Verification Details
                doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
                doc.text('VERIFICATION DETAILS', centerX + 50, footerY - 20);
                doc.font('Helvetica').fontSize(8).fillColor('#64748b');
                doc.text(`CERTIFICATE ID: ${attendanceData.certificateId}`, centerX + 50, footerY - 5);
                doc.text(`VERIFICATION CODE: ${attendanceData.verificationCode}`, centerX + 50, footerY + 7);
                doc.text(`SECURE URL: aaventure.com/verify/${attendanceData.certificateId}`, centerX + 50, footerY + 19);

                // Finalize PDF
                doc.end();

                stream.on('finish', () => {
                    resolve({
                        success: true,
                        filepath: filepath,
                        filename: filename,
                        url: `/certificates/${filename}`
                    });
                });

                stream.on('error', (error) => reject(error));
            } catch (error) {
                reject(error);
            }
        });
    }

    static generateVerificationCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters
        let code = '';
        for (let i = 0; i < 12; i++) {
            if (i > 0 && i % 4 === 0) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}

module.exports = CertificateGenerator;
