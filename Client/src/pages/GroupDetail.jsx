import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import API from '../api';
import Sidebar from '../components/Sidebar';

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const sidebarItems = [
    { label: 'Groups', to: '/groups' },
    { label: 'My Exams', to: '/exams' },
    { label: 'Dashboard', to: '/dashboard' },
  ];

  useEffect(() => {
    const loadGroup = async () => {
      try {
        setLoading(true);
        const [groupRes, membersRes, examsRes] = await Promise.all([
          API.get(`/groups/${id}`),
          API.get(`/groups/${id}/members`),
          API.get(`/groups/${id}/exams`),
        ]);
        setGroup(groupRes.data);
        setMembers(membersRes.data || []);
        setExams(examsRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadGroup();
  }, [id]);

  return (
    <div className='dashboard-layout'>
      <Sidebar title='Group' items={sidebarItems} />
      <section className='dashboard-main'>
        {loading ? (
          <div className='card'>Loading group...</div>
        ) : !group ? (
          <div className='card'>Group not found.</div>
        ) : (
          <>
            <div className='card group-header'>
              <div>
                <h2>{group.name}</h2>
                <p className='section-subtitle'>{group.description || 'No description provided.'}</p>
              </div>
              <div className='group-header-meta'>
                <span className='status-pill'>{group.membershipRole || 'student'}</span>
                <span className='muted'>Join code: {group.joinCode}</span>
              </div>
            </div>

            <div className='grid groups-grid'>
              <section className='card'>
                <h3>Members</h3>
                <div className='table-wrap'>
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length > 0 ? (
                        members.map((member) => (
                          <tr key={member._id}>
                            <td>{member.userId?.name || 'Member'}</td>
                            <td>{member.userId?.email || '-'}</td>
                            <td>{member.role}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan='3'>No members found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className='card'>
                <h3>Group Exams</h3>
                <div className='table-wrap'>
                  <table>
                    <thead>
                      <tr>
                        <th>Exam</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.length > 0 ? (
                        exams.map((exam) => (
                          <tr key={exam._id}>
                            <td>{exam.title}</td>
                            <td>{exam.status}</td>
                            <td>{new Date(exam.startTime).toLocaleString()}</td>
                            <td>
                              <Link to={`/exam/${exam._id}`} className='btn secondary'>
                                Open Lobby
                              </Link>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan='4'>No exams in this group.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
