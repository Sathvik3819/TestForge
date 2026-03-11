import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API from '../api';

function createQuestion() {
    return {
        text: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: 'A',
        marks: 1,
        negativeMarks: 0,
    };
}

function mapExamQuestion(question) {
    return {
        text: question.text || '',
        optionA: question.options?.[0]?.text || '',
        optionB: question.options?.[1]?.text || '',
        optionC: question.options?.[2]?.text || '',
        optionD: question.options?.[3]?.text || '',
        correctAnswer:
            question.correctAnswer === question.options?.[0]?.text ? 'A'
                : question.correctAnswer === question.options?.[1]?.text ? 'B'
                    : question.correctAnswer === question.options?.[2]?.text ? 'C'
                        : 'D',
        marks: question.marks || 1,
        negativeMarks: question.negativeMarks || 0,
    };
}

export default function AdminCreateExam({ onExamCreated, editExamId }) {
    const location = useLocation();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        title: '',
        description: '',
        groupId: location.state?.groupId || '',
        duration: 60,
        startTime: '',
        marksPerQuestion: 1,
        negativeMarking: 0,
        resultVisibility: 'immediate',
        maxAttempts: 1,
        allowRetake: false,
        publishImmediately: true,
    });
    const [questions, setQuestions] = useState([createQuestion()]);
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [groups, setGroups] = useState([]);

    useEffect(() => {
        const loadGroups = async () => {
            try {
                const res = await API.get('/groups/created');
                setGroups(res.data || []);
            } catch (err) {
                console.error(err);
            }
        };
        loadGroups();
    }, []);

    useEffect(() => {
        if (!editExamId) return;

        const loadExam = async () => {
            try {
                setIsLoading(true);
                const res = await API.get(`/exams/${editExamId}`);
                const exam = res.data;
                setForm({
                    title: exam.title || '',
                    description: exam.description || '',
                    groupId: typeof exam.groupId === 'string' ? exam.groupId : exam.groupId?._id || '',
                    duration: exam.duration || 60,
                    startTime: exam.startTime ? new Date(exam.startTime).toISOString().slice(0, 16) : '',
                    marksPerQuestion: exam.marksPerQuestion || 1,
                    negativeMarking: exam.negativeMarking || 0,
                    resultVisibility: exam.resultVisibility || 'immediate',
                    maxAttempts: exam.maxAttempts || 1,
                    allowRetake: exam.allowRetake || false,
                    publishImmediately: false,
                });
                const mappedQuestions = (exam.questions || []).map(mapExamQuestion);
                setQuestions(mappedQuestions.length ? mappedQuestions : [createQuestion()]);
            } catch (err) {
                setStatus('Failed to load exam for editing');
            } finally {
                setIsLoading(false);
            }
        };

        loadExam();
    }, [editExamId]);

    const updateQuestion = (idx, key, value) => {
        setQuestions((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [key]: value };
            return next;
        });
    };

    const addQuestion = () => setQuestions((prev) => [...prev, createQuestion()]);

    const removeQuestion = (idx) => {
        if (questions.length > 1) {
            setQuestions((prev) => prev.filter((_, index) => index !== idx));
        }
    };

    const resetForm = () => {
        setForm({
            title: '',
            description: '',
            groupId: '',
            duration: 60,
            startTime: '',
            marksPerQuestion: 1,
            negativeMarking: 0,
            resultVisibility: 'immediate',
            maxAttempts: 1,
            allowRetake: false,
            publishImmediately: true,
        });
        setQuestions([createQuestion()]);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setStatus('');
        setIsLoading(true);

        try {
            if (editExamId) {
                await API.patch(`/exams/${editExamId}`, {
                    title: form.title,
                    description: form.description,
                    duration: Number(form.duration),
                    startTime: form.startTime,
                    totalMarks: Number(form.marksPerQuestion) * questions.length,
                    marksPerQuestion: Number(form.marksPerQuestion),
                    negativeMarking: Number(form.negativeMarking || 0),
                    resultVisibility: form.resultVisibility,
                    maxAttempts: Number(form.maxAttempts || 1),
                    allowRetake: Boolean(form.allowRetake),
                });
            } else {
                const examRes = await API.post('/exams/create', {
                    title: form.title,
                    description: form.description,
                    groupId: form.groupId,
                    duration: Number(form.duration),
                    startTime: form.startTime,
                    totalMarks: Number(form.marksPerQuestion) * questions.length,
                    numberOfQuestions: questions.length,
                    marksPerQuestion: Number(form.marksPerQuestion),
                    negativeMarking: Number(form.negativeMarking || 0),
                    resultVisibility: form.resultVisibility,
                    maxAttempts: Number(form.maxAttempts || 1),
                    allowRetake: Boolean(form.allowRetake),
                });

                const examId = examRes.data._id;
                await Promise.all(
                    questions.map((question) =>
                        API.post(`/exams/${examId}/questions`, {
                            text: question.text,
                            options: [
                                question.optionA,
                                question.optionB,
                                question.optionC,
                                question.optionD,
                            ],
                            correctAnswer: {
                                A: question.optionA,
                                B: question.optionB,
                                C: question.optionC,
                                D: question.optionD,
                            }[question.correctAnswer],
                            marks: Number(question.marks || 1),
                            negativeMarks: Number(question.negativeMarks || 0),
                        }),
                    ),
                );

                if (form.publishImmediately) {
                    await API.patch(`/exams/${examId}/publish`);
                }
            }

            setStatus(editExamId ? 'Exam updated successfully.' : 'Exam saved successfully.');
            if (!editExamId) {
                resetForm();
            }

            setTimeout(() => {
                if (location.state?.groupId) {
                    navigate(`/groups/${location.state.groupId}`);
                } else if (onExamCreated) {
                    onExamCreated();
                }
            }, 1000);
        } catch (err) {
            setStatus(err.response?.data?.msg || err.response?.data?.error || 'Failed to save exam');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className='admin-section'>
            <h2>{editExamId ? 'Edit Exam' : 'Create New Exam'}</h2>
            <form className='card create-exam-form' onSubmit={handleSave}>
                <h3>Exam Information</h3>
                <div className='grid two-col'>
                    <div>
                        <label>Group *</label>
                        <select
                            required
                            value={form.groupId}
                            onChange={(e) => setForm((prev) => ({ ...prev, groupId: e.target.value }))}
                            disabled={Boolean(editExamId) || Boolean(location.state?.groupId)}
                        >
                            <option value=''>Select group</option>
                            {groups.map((group) => (
                                <option key={group._id} value={group._id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>Exam Title *</label>
                        <input
                            required
                            placeholder='e.g., DBMS Test'
                            value={form.title}
                            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label>Duration (minutes) *</label>
                        <input
                            type='number'
                            required
                            min='1'
                            value={form.duration}
                            onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label>Start Time *</label>
                        <input
                            type='datetime-local'
                            required
                            value={form.startTime}
                            onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label>Marks per Question *</label>
                        <input
                            type='number'
                            min='1'
                            step='0.25'
                            required
                            value={form.marksPerQuestion}
                            onChange={(e) => setForm((prev) => ({ ...prev, marksPerQuestion: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label>Negative Marking</label>
                        <input
                            type='number'
                            min='0'
                            step='0.25'
                            value={form.negativeMarking}
                            onChange={(e) => setForm((prev) => ({ ...prev, negativeMarking: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label>Result Visibility</label>
                        <select
                            value={form.resultVisibility}
                            onChange={(e) => setForm((prev) => ({ ...prev, resultVisibility: e.target.value }))}
                        >
                            <option value='immediate'>Immediate</option>
                            <option value='delayed'>Delayed</option>
                        </select>
                    </div>
                    <div>
                        <label>Max Attempts</label>
                        <input
                            type='number'
                            min='1'
                            value={form.maxAttempts}
                            onChange={(e) => setForm((prev) => ({ ...prev, maxAttempts: e.target.value }))}
                        />
                    </div>
                </div>

                <div>
                    <label>Description</label>
                    <textarea
                        placeholder='Enter exam description...'
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                        rows='3'
                    />
                </div>

                {!editExamId && groups.length === 0 && (
                    <p className='muted'>
                        Create a group first from the Groups page before creating an exam.
                    </p>
                )}

                <div className='split'>
                    <label style={{ margin: 0 }}>Publish immediately after save</label>
                    <input
                        type='checkbox'
                        checked={form.publishImmediately}
                        onChange={(e) => setForm((prev) => ({ ...prev, publishImmediately: e.target.checked }))}
                        style={{ width: 'auto' }}
                    />
                </div>

                <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

                <div className='split'>
                    <h3 style={{ marginBottom: 0 }}>Questions ({questions.length})</h3>
                    <button type='button' className='btn secondary' onClick={addQuestion}>
                        + Add Question
                    </button>
                </div>

                <div className='question-builder-list'>
                    {questions.map((question, idx) => (
                        <div key={idx} className='question-builder-card'>
                            <div className='split'>
                                <h4 style={{ marginBottom: 0 }}>Question {idx + 1}</h4>
                                {questions.length > 1 && (
                                    <button
                                        type='button'
                                        className='btn danger'
                                        onClick={() => removeQuestion(idx)}
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>

                            <label>Question Text *</label>
                            <textarea
                                required
                                placeholder='Enter question...'
                                value={question.text}
                                onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                                rows='2'
                            />

                            <div className='grid two-col'>
                                <div>
                                    <label>Option A *</label>
                                    <input
                                        required
                                        placeholder='Option A'
                                        value={question.optionA}
                                        onChange={(e) => updateQuestion(idx, 'optionA', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label>Option B *</label>
                                    <input
                                        required
                                        placeholder='Option B'
                                        value={question.optionB}
                                        onChange={(e) => updateQuestion(idx, 'optionB', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label>Option C *</label>
                                    <input
                                        required
                                        placeholder='Option C'
                                        value={question.optionC}
                                        onChange={(e) => updateQuestion(idx, 'optionC', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label>Option D *</label>
                                    <input
                                        required
                                        placeholder='Option D'
                                        value={question.optionD}
                                        onChange={(e) => updateQuestion(idx, 'optionD', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className='grid two-col'>
                                <div>
                                    <label>Correct Answer *</label>
                                    <select
                                        value={question.correctAnswer}
                                        onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                                    >
                                        <option value='A'>Option A</option>
                                        <option value='B'>Option B</option>
                                        <option value='C'>Option C</option>
                                        <option value='D'>Option D</option>
                                    </select>
                                </div>
                                <div>
                                    <label>Marks</label>
                                    <input
                                        type='number'
                                        min='1'
                                        step='0.25'
                                        value={question.marks}
                                        onChange={(e) => updateQuestion(idx, 'marks', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label>Negative Marks</label>
                                    <input
                                        type='number'
                                        min='0'
                                        step='0.25'
                                        value={question.negativeMarks}
                                        onChange={(e) => updateQuestion(idx, 'negativeMarks', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {status && (
                    <div className={`status-message ${status.toLowerCase().includes('successfully') ? 'success' : 'error'}`}>
                        {status}
                    </div>
                )}
                <button type='submit' className='btn' disabled={isLoading}>
                    {isLoading ? (editExamId ? 'Updating...' : 'Saving...') : (editExamId ? 'Update Exam' : 'Save Exam')}
                </button>
            </form>
        </section>
    );
}
