const { expect } = require('chai');
const {
    buildSubmissionKey,
    buildValidationErrors,
    maskName
} = require('../../server/utils/attendanceSubmissionUtils');

describe('Attendance submission utils', () => {
    it('builds deterministic submission keys for normalized-equivalent input', () => {
        const first = buildSubmissionKey({
            userId: 'u1',
            meetingDate: '2026-02-22',
            meetingTime: '7:00PM EDT',
            meetingTopic: ' Step 1 Discussion '
        });
        const second = buildSubmissionKey({
            userId: 'u1',
            meetingDate: '2026-02-22',
            meetingTime: '7:00PM EDT',
            meetingTopic: 'step 1 discussion'
        });

        expect(first).to.equal(second);
    });

    it('returns required-field errors with exact phrase', () => {
        const errors = buildValidationErrors({
            meetingDate: '',
            meetingTime: '',
            meetingTopic: '',
            meetingChairperson: '',
            participationInfo: '',
            fullName: '',
            email: '',
            sendAdditionalRecipient: '',
            additionalRecipientEmail: ''
        });

        Object.values(errors).forEach((message) => {
            expect(message).to.equal('The field is required.');
        });
    });

    it('masks names for public verification', () => {
        expect(maskName('Jane Doe')).to.equal('J*** D***');
        expect(maskName('Sam')).to.equal('S***');
    });
});
