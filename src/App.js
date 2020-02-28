import React, { useState, useEffect } from 'react';
import './App.css';

import axios from 'axios';
import csv from 'csvtojson';
import { set, format } from 'date-fns';

function App() {
  const [urlCsv, setUrlCsv] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(
    (new Date().getMonth() + 1).toString().padStart(2, '0')
  );
  const [hours, setHours] = useState([]);
  const [userInfo, setUserInfo] = useState({});
  const [workspaceId, setWorkspaceId] = useState('');
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState('');
  const [tasks, setTasks] = useState([]);
  const [task, setTask] = useState('');

  useEffect(() => {
    if (project) {
      const getTasks = async () => {
        const { data } = await axios.get(
          `https://api.clockify.me/api/v1/workspaces/${workspaceId}/projects/${project}/tasks`,
          {
            headers: {
              'X-Api-Key': apiKey,
            },
          }
        );
        setTasks([...data]);
      };

      getTasks();
    }
  }, [apiKey, project, workspaceId]);

  const handleSubmit = async () => {
    if (urlCsv && apiKey) {
      const { data: user } = await axios.get(
        'https://api.clockify.me/api/v1/user',
        {
          headers: {
            'X-Api-Key': apiKey,
          },
        }
      );

      const { data: strCsv } = await axios.get(urlCsv);
      const csvData = await csv({
        noheader: true,
        output: 'csv',
      }).fromString(strCsv);

      const data = [];

      setUserInfo({ ...user });
      csvData.forEach((hour, index) => {
        if (index > 31) return;

        const day = (index + 1).toString().padStart(2, '0');
        const [
          morningStart,
          morningEnd,
          afternoonStart,
          afternoonEnd,
          ...transh
        ] = hour;
        const description = transh[transh.length - 1];

        if (morningStart && morningEnd) {
          const [hoursMorningStart, minutesMorningStart] = morningStart.split(
            ':'
          );
          const [hoursMorningEnd, minutesMorningEnd] = morningEnd.split(':');

          const morning = {
            description: !!description ? description : 'Morning Time',
            start: set(new Date(year, month - 1, day), {
              hours: hoursMorningStart,
              minutes: minutesMorningStart,
              seconds: 0,
            }),
            end: set(new Date(year, month - 1, day), {
              hours: hoursMorningEnd,
              minutes: minutesMorningEnd,
              seconds: 0,
            }),
          };

          data.push(morning);
        }

        if (afternoonStart && afternoonEnd) {
          const [
            hoursAfternoonStart,
            minutesAfternoonStart,
          ] = afternoonStart.split(':');
          const [hoursAfternoonEnd, minutesAfternoonEnd] = afternoonEnd.split(
            ':'
          );

          const afternoon = {
            description: !!description ? description : 'Afternoon Time',
            start: set(new Date(year, month - 1, day), {
              hours: hoursAfternoonStart,
              minutes: minutesAfternoonStart,
              seconds: 0,
            }),
            end: set(new Date(year, month - 1, day), {
              hours: hoursAfternoonEnd,
              minutes: minutesAfternoonEnd,
              seconds: 0,
            }),
          };

          data.push(afternoon);
        }
      });

      setHours([...data]);

      const f_workspaceId = user.memberships.find(
        m => m.membershipType === 'WORKSPACE' && m.membershipStatus === 'ACTIVE'
      ).targetId;
      setWorkspaceId(f_workspaceId);

      const { data: dataProjects } = await axios.get(
        `https://api.clockify.me/api/v1/workspaces/${f_workspaceId}/projects`,
        {
          headers: {
            'X-Api-Key': apiKey,
          },
        }
      );

      setProjects([...dataProjects]);
    }
  };

  const setMonthYear = monthYear => {
    const [t_year, t_month] = monthYear.split('-');
    setYear(t_year);
    setMonth(t_month);
  };

  const sendToClockify = async () => {
    for (let hour of hours) {
      await axios.post(
        `https://api.clockify.me/api/v1/workspaces/${workspaceId}/time-entries`,
        {
          start: hour.start,
          billable: 'true',
          description: hour.description,
          projectId: project,
          taskId: task,
          end: hour.end,
          tagIds: [],
        },
        {
          headers: {
            'X-Api-Key': apiKey,
          },
        }
      );
    }
  }

  return (
    <div className="App">
      <div style={{ display: 'inline-grid' }}>
        <input
          type="url"
          placeholder="URL Google Sheets CSV"
          onChange={e => setUrlCsv(e.target.value)}
          value={urlCsv}
        />
        <input
          type="text"
          placeholder="CLockify API KEY"
          onChange={e => setApiKey(e.target.value)}
          value={apiKey}
        />
        <input
          type="month"
          onChange={e => setMonthYear(e.target.value)}
          value={`${year}-${month}`}
        />
        <button onClick={() => handleSubmit()}>Go</button>
      </div>
      {userInfo.name && (
        <h1>
          Olá, {userInfo.name}, esta é a sua planilha de horários que será
          importada para o CLockify
        </h1>
      )}
      {hours.length > 0 && (
        <div style={{ display: 'table', margin: 'auto' }}>
          <table border="1">
            <thead>
              <tr>
                <th>Data</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {hours &&
                hours.map(({ description, start, end }, index) => (
                  <tr key={index}>
                    <td>{format(start, 'dd/MM/yyyy')}</td>
                    <td>{format(start, 'HH:mm')}</td>
                    <td>{format(end, 'HH:mm')}</td>
                    <td>{description}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        {projects.length > 0 && (
          <select onChange={e => setProject(e.target.value)}>
            <option value="">Selecione o projeto</option>
            {projects.length > 0 &&
              projects.map(({ id, name }) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
          </select>
        )}
        {tasks.length > 0 && (
          <select onChange={e => setTask(e.target.value)}>
            <option value="">Selecione a task</option>
            {tasks.length > 0 &&
              tasks.map(({ id, name }) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
          </select>
        )}

        {task && project && (<button onClick={() => sendToClockify()}>Registrar horas</button>)}
      </div>
    </div>
  );
}

export default App;
