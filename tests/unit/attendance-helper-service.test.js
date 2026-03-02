const { expect } = require('chai');
const { getSuggestions } = require('../../server/utils/attendanceHelperService');

describe('Attendance helper service', () => {
    it('returns draft suggestions and disclaimer', () => {
        const result = getSuggestions({
            meetingTopic: 'AA meeting',
            participationInfo: 'Listened'
        });

        expect(result).to.have.property('meetingTopicSuggestion');
        expect(result).to.have.property('participationInfoSuggestion');
        expect(result).to.have.property('chairpersonPromptHint');
        expect(result).to.have.property('qualityWarnings');
        expect(result.disclaimer.toLowerCase()).to.include('review');
    });

    it('flags generic topic quality warning', () => {
        const result = getSuggestions({
            meetingTopic: 'meeting',
            participationInfo: 'ok'
        });

        expect(result.qualityWarnings.length).to.be.greaterThan(0);
    });
});
