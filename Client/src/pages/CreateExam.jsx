import { useState } from 'react';
import { useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import API from '../api';

const adminSidebar = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Create Exam', to: '/create-exam' },
  { label: 'Manage Exams', to: '/exams' },
  { label: 'Candidates', to: '/monitoring' },
  { label: 'Monitoring', to: '/monitoring' },
  { label: 'Results', to: '/results' },
];

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

export default function CreateExam() {
  const [form, setForm] = useState({
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
  const [questions, setQuestions] = useState([createQuestion()]);
  const [status, setStatus] = useState('');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const res = await API.get('/groups/my');
        setGroups((res.data || []).filter((group) => group.membershipRole === 'admin'));
      } catch (err) {
        console.error(err);
      }
    };
    loadGroups();
  }, []);

  const updateQuestion = (idx, key, value) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const addQuestion = () => setQuestions((prev) => [...prev, createQuestion()]);

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus('');
    try {
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
        questions.map((q) =>
          API.post(`/exams/${examId}/questions`, {
            text: q.text,
            options: [q.optionA, q.optionB, q.optionC, q.optionD],
            correctAnswer: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[q.correctAnswer],
            marks: Number(q.marks || 1),
            negativeMarks: Number(q.negativeMarks || 0),
          }),
        ),
      );

      if (form.publishImmediately) {
        await API.patch(`/exams/${examId}/publish`);
      }

      setStatus('Exam saved successfully.');
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
    } catch (err) {
      setStatus(err.response?.data?.msg || 'Failed to save exam');
    }
  };

  return (
    <div className='dashboard-layout'>
      <Sidebar title='Admin Panel' items={adminSidebar} />
      <section className='dashboard-main'>
        <h2>Exam Creation</h2>
        <form className='card create-exam-form' onSubmit={handleSave}>
          <h3>Exam Info</h3>
          <div className='grid two-col'>
            <div>
              <label>Group</label>
              <select
                required
                value={form.groupId}
                onChange={(e) => setForm((prev) => ({ ...prev, groupId: e.target.value }))}
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
              <label>Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <label>Duration (min)</label>
              <input
                type='number'
                required
                value={form.duration}
                onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
              />
            </div>
            <div>
              <label>Start Time</label>
              <input
                type='datetime-local'
                required
                value={form.startTime}
                onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label>Marks per Question</label>
              <input
                type='number'
                min='1'
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
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className='split'>
            <label style={{ margin: 0 }}>Publish immediately after save</label>
            <input
              type='checkbox'
              checked={form.publishImmediately}
              onChange={(e) => setForm((prev) => ({ ...prev, publishImmediately: e.target.checked }))}
              style={{ width: 'auto' }}
            />
          </div>

          <div className='split'>
            <h3>Question Builder</h3>
            <button type='button' className='btn secondary' onClick={addQuestion}>
              Add Question
            </button>
          </div>

          <div className='question-builder-list'>
            {questions.map((question, idx) => (
              <div key={idx} className='question-builder-card'>
                <h4>Question {idx + 1}</h4>
                <label>Question</label>
                <textarea
                  required
                  value={question.text}
                  onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                />
                <div className='grid two-col'>
                  <div>
                    <label>Option A</label>
                    <input
                      required
                      value={question.optionA}
                      onChange={(e) => updateQuestion(idx, 'optionA', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Option B</label>
                    <input
                      required
                      value={question.optionB}
                      onChange={(e) => updateQuestion(idx, 'optionB', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Option C</label>
                    <input
                      required
                      value={question.optionC}
                      onChange={(e) => updateQuestion(idx, 'optionC', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Option D</label>
                    <input
                      required
                      value={question.optionD}
                      onChange={(e) => updateQuestion(idx, 'optionD', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Correct Answer</label>
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

          {status && <p className='muted'>{status}</p>}
          <button type='submit' className='btn'>
            Save Exam
          </button>
        </form>
      </section>
    </div>
  );
}
