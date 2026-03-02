process.env.NODE_ENV = 'test';
process.env.BASE_URL = 'https://aaventure.example';
process.env.JWT_SECRET = 'test-secret';
process.env.ATTENDANCE_VERIFICATION_FORM_V2 = 'true';
process.env.ATTENDANCE_DISABLE_EMAIL_QUEUE = 'true';
process.env.ATTENDANCE_SUBMISSION_REQUIRE_SUBSCRIPTION = 'false';

const { expect } = require('chai');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const User = require('../../server/models/User');
const Attendance = require('../../server/models/Attendance');
const AttendanceSubmission = require('../../server/models/AttendanceSubmission');
const { app } = require('../../server/index');

describe('Attendance v2 integration', () => {
    const fakeUserId = new mongoose.Types.ObjectId();
    let originals = {};

    const buildToken = () => jwt.sign({ userId: fakeUserId.toString() }, process.env.JWT_SECRET);

    beforeEach(() => {
        originals = {
            userFindById: User.findById,
            attendanceFindOne: Attendance.findOne,
            submissionFindOne: AttendanceSubmission.findOne,
            submissionCreate: AttendanceSubmission.create,
            submissionFindById: AttendanceSubmission.findById
        };

        User.findById = async () => ({
            _id: fakeUserId,
            chatName: 'Test User',
            email: 'test@example.com',
            hasActiveSubscription: () => true
        });

        Attendance.findOne = () => ({
            sort: async () => null
        });
        AttendanceSubmission.findById = async () => null;
    });

    afterEach(() => {
        User.findById = originals.userFindById;
        Attendance.findOne = originals.attendanceFindOne;
        AttendanceSubmission.findOne = originals.submissionFindOne;
        AttendanceSubmission.create = originals.submissionCreate;
        AttendanceSubmission.findById = originals.submissionFindById;
    });

    it('stores submission via submit endpoint', async () => {
        const token = buildToken();
        const agent = request.agent(app);

        AttendanceSubmission.findOne = async () => null;
        AttendanceSubmission.create = async (payload) => ({
            _id: new mongoose.Types.ObjectId(),
            ...payload,
            revision: 1,
            save: async function save() { return this; }
        });

        const metadataRes = await agent
            .get('/api/attendance/verification-form-metadata')
            .set('Authorization', `Bearer ${token}`);
        expect(metadataRes.status).to.equal(200);
        expect(metadataRes.body.meetingIdDisplay).to.be.a('string');

        const submitRes = await agent
            .post('/api/attendance/submit-verification-form')
            .set('Authorization', `Bearer ${token}`)
            .send({
                meetingDate: '2026-02-22',
                meetingTime: '7:00PM EDT',
                meetingTopic: 'Step 2 - Hope',
                meetingChairperson: 'Jane Doe',
                participationInfo: 'I listened and shared one short reflection.',
                fullName: 'Tester Name',
                email: 'tester@example.com',
                sendAdditionalRecipient: 'no',
                additionalRecipientEmail: '',
                meetingIdDisplay: metadataRes.body.meetingIdDisplay
            });

        expect(submitRes.status).to.equal(200);
        expect(submitRes.body.success).to.equal(true);
        expect(submitRes.body.revision).to.equal(1);
    });

    it('upserts duplicate submission and increments revision', async () => {
        const token = buildToken();
        const agent = request.agent(app);
        const submissionId = new mongoose.Types.ObjectId();
        let storedRecord = null;

        AttendanceSubmission.create = async (payload) => {
            storedRecord = {
                _id: submissionId,
                revision: 1,
                status: 'submitted',
                ...payload,
                save: async function save() { return this; }
            };
            return storedRecord;
        };

        AttendanceSubmission.findOne = async () => storedRecord;

        const metadataRes = await agent
            .get('/api/attendance/verification-form-metadata')
            .set('Authorization', `Bearer ${token}`);

        const body = {
            meetingDate: '2026-02-22',
            meetingTime: '7:00PM EDT',
            meetingTopic: 'Step 3 - Action',
            meetingChairperson: 'Alex Chair',
            participationInfo: 'Shared about accountability and listened to peers.',
            fullName: 'Tester Name',
            email: 'tester@example.com',
            sendAdditionalRecipient: 'no',
            additionalRecipientEmail: '',
            meetingIdDisplay: metadataRes.body.meetingIdDisplay
        };

        const first = await agent
            .post('/api/attendance/submit-verification-form')
            .set('Authorization', `Bearer ${token}`)
            .send(body);
        expect(first.status).to.equal(200);
        expect(first.body.revision).to.equal(1);

        const second = await agent
            .post('/api/attendance/submit-verification-form')
            .set('Authorization', `Bearer ${token}`)
            .send(body);
        expect(second.status).to.equal(200);
        expect(second.body.revision).to.equal(2);
    });

    it('helper endpoint returns suggestions and does not persist submissions', async () => {
        const token = buildToken();
        let createCalled = false;
        AttendanceSubmission.create = async () => {
            createCalled = true;
            throw new Error('should not be called');
        };
        AttendanceSubmission.findOne = async () => null;

        const res = await request(app)
            .post('/api/attendance/helper-suggest')
            .set('Authorization', `Bearer ${token}`)
            .send({
                meetingTopic: 'Meeting',
                participationInfo: 'Listened'
            });

        expect(res.status).to.equal(200);
        expect(res.body.success).to.equal(true);
        expect(res.body.disclaimer).to.be.a('string');
        expect(createCalled).to.equal(false);
    });

    it('verify endpoint returns masked attendee identity', async () => {
        Attendance.findOne = () => ({
            populate() {
                return this;
            },
            then(resolve) {
                resolve({
                    certificateId: 'cert_123',
                    attendeeFullNameMasked: 'J*** D***',
                    meetingTitle: 'Test Meeting',
                    meetingType: 'AA',
                    joinTime: new Date('2026-02-22T19:00:00Z'),
                    duration: 3600
                });
            }
        });

        const res = await request(app).get('/api/attendance/verify/cert_123');
        expect(res.status).to.equal(200);
        expect(res.body.success).to.equal(true);
        expect(res.body.certificate.attendeeNameMasked).to.equal('J*** D***');
    });
});
