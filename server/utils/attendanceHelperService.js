const { sanitizeText } = require('./attendanceSubmissionUtils');

function buildQualityWarnings({ meetingTopic, participationInfo }) {
    const warnings = [];
    const topic = sanitizeText(meetingTopic, 200).toLowerCase();
    const notes = sanitizeText(participationInfo, 1000).toLowerCase();

    if (!topic || topic.length < 6 || ['aa meeting', 'na meeting', 'open meeting', 'meeting'].includes(topic)) {
        warnings.push('Meeting topic looks generic. Use the specific session topic discussed.');
    }

    if (!notes || notes.length < 12) {
        warnings.push('Participation notes are brief. Add one sentence about how you participated.');
    }

    return warnings;
}

function getSuggestions(input = {}) {
    const topic = sanitizeText(input.meetingTopic, 200);
    const chair = sanitizeText(input.meetingChairperson, 120);
    const notes = sanitizeText(input.participationInfo, 1000);

    const meetingTopicSuggestion = topic
        ? `${topic} - Experience, Strength, and Hope`
        : 'Step-focused discussion: Applying recovery principles in daily life';

    const participationInfoSuggestion = notes
        ? `${notes} I listened actively and reflected on how the discussion applies to my recovery.`
        : 'I listened attentively, related to the shared experiences, and reflected on practical recovery steps for today.';

    const chairpersonPromptHint = chair
        ? `Confirm spelling for chairperson name: ${chair}.`
        : 'Include the full name of the chairperson leading this session.';

    return {
        meetingTopicSuggestion,
        participationInfoSuggestion,
        chairpersonPromptHint,
        qualityWarnings: buildQualityWarnings(input),
        disclaimer: 'Suggestions are drafts only. Review and edit before submitting.'
    };
}

module.exports = {
    getSuggestions
};
