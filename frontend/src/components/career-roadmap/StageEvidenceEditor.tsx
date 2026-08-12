import { useState } from 'react';
import type { ProgressEvidence } from './career-roadmap.types';

type StageEvidenceEditorProps = {
  evidence: ProgressEvidence[];
  onAdd: (evidence: ProgressEvidence) => Promise<boolean>;
};

export const StageEvidenceEditor = ({ evidence, onAdd }: StageEvidenceEditorProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ProgressEvidence['type']>('project');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    const saved = await onAdd({
      id: crypto.randomUUID(),
      type,
      title: title.trim(),
      ...(url.trim() ? { url: url.trim() } : {}),
      ...(details.trim() ? { details: details.trim() } : {}),
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    if (!saved) {
      setError('Could not save this evidence. Please try again.');
      return;
    }
    setTitle('');
    setUrl('');
    setDetails('');
    setOpen(false);
  };

  return (
    <div className="stage-evidence">
      <div className="stage-evidence-head">
        <strong>Progress evidence</strong>
        <button type="button" onClick={() => setOpen((value) => !value)}>{open ? 'Cancel' : 'Add evidence'}</button>
      </div>
      {evidence.length > 0 && (
        <ul>
          {evidence.map((item) => (
            <li key={item.id}>
              <span>{item.type}</span>
              {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}
              {item.details && <small>{item.details}</small>}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="stage-evidence-form">
          <label>Evidence type<select value={type} onChange={(event) => setType(event.target.value as ProgressEvidence['type'])}><option value="project">Project</option><option value="promotion">Promotion</option><option value="responsibility">Responsibility</option><option value="note">Note</option></select></label>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What did you achieve?" /></label>
          <label>Link (optional)<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></label>
          <label>Outcome (optional)<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Team size, impact, promotion scope…" /></label>
          <button type="button" onClick={() => void submit()} disabled={!title.trim() || saving}>{saving ? 'Saving…' : 'Save evidence'}</button>
          {error && <span className="stage-evidence-error" role="alert">{error}</span>}
        </div>
      )}
    </div>
  );
};
