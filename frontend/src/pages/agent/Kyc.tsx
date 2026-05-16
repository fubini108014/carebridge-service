import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders } from '../../lib/liff';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

interface FileUploadField {
  label: string;
  key: 'idCard' | 'bankBook';
  category: 'id_card' | 'bank_book';
  objectKey: string | null;
  state: UploadState;
  preview: string | null;
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' },
  backBtn: { background: 'none', border: 'none', color: '#06C755', fontSize: '15px', cursor: 'pointer', padding: 0, marginBottom: '16px' },
  title: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' },
  subtitle: { color: '#666', fontSize: '13px', margin: '0 0 24px' },
  fieldBox: { marginBottom: '20px' },
  label: { display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' },
  uploadArea: {
    border: '2px dashed #d0d0d0', borderRadius: '10px',
    padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#fafafa',
  },
  uploadAreaDone: {
    border: '2px solid #06C755', borderRadius: '10px',
    padding: '8px', textAlign: 'center', background: '#f6fff9',
  },
  preview: { maxWidth: '100%', maxHeight: '160px', borderRadius: '6px', objectFit: 'contain' },
  hint: { color: '#888', fontSize: '13px', margin: '4px 0 0' },
  statusText: { fontSize: '13px', marginTop: '4px' },
  uploading: { color: '#aaa' },
  done: { color: '#06C755' },
  error: { color: 'red' },
  submitBtn: {
    width: '100%', padding: '14px',
    background: '#06C755', border: 'none', borderRadius: '8px',
    color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer',
  },
  submitBtnDisabled: {
    width: '100%', padding: '14px',
    background: '#aaa', border: 'none', borderRadius: '8px',
    color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'not-allowed',
  },
  successBox: { background: '#f0fff4', border: '1px solid #06C755', borderRadius: '8px', padding: '20px', textAlign: 'center', marginTop: '16px' },
  successText: { color: '#06C755', fontWeight: 'bold', fontSize: '16px', margin: '0 0 8px' },
  successSub: { color: '#555', fontSize: '13px', margin: 0 },
};

export default function AgentKyc() {
  const navigate = useNavigate();
  const idCardRef = useRef<HTMLInputElement>(null);
  const bankBookRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fields, setFields] = useState<Record<'idCard' | 'bankBook', Omit<FileUploadField, 'label' | 'key' | 'category'>>>({
    idCard: { objectKey: null, state: 'idle', preview: null },
    bankBook: { objectKey: null, state: 'idle', preview: null },
  });

  async function handleFileChange(
    key: 'idCard' | 'bankBook',
    category: 'id_card' | 'bank_book',
    file: File
  ) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], state: 'uploading', preview: null } }));

    try {
      // 1. Get presigned URL
      const params = new URLSearchParams({ category, contentType: file.type });
      const res = await fetch(`/api/agent/presigned-url?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('無法取得上傳憑證');
      const { uploadUrl, objectKey } = await res.json() as { uploadUrl: string; objectKey: string };

      // 2. PUT file directly to S3
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('上傳失敗');

      const preview = URL.createObjectURL(file);
      setFields((prev) => ({ ...prev, [key]: { objectKey, state: 'done', preview } }));
    } catch (e: unknown) {
      setFields((prev) => ({ ...prev, [key]: { ...prev[key], state: 'error', preview: null } }));
      console.error(e);
    }
  }

  async function handleSubmit() {
    const { idCard, bankBook } = fields;
    if (!idCard.objectKey || !bankBook.objectKey) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/agent/kyc', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ idCardUrl: idCard.objectKey, bankBookUrl: bankBook.objectKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '提交失敗');
      setSubmitted(true);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : '發生錯誤');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldDefs: { label: string; key: 'idCard' | 'bankBook'; category: 'id_card' | 'bank_book'; ref: React.RefObject<HTMLInputElement> }[] = [
    { label: '身分證正面', key: 'idCard', category: 'id_card', ref: idCardRef as React.RefObject<HTMLInputElement> },
    { label: '銀行存摺封面', key: 'bankBook', category: 'bank_book', ref: bankBookRef as React.RefObject<HTMLInputElement> },
  ];

  const allUploaded = fields.idCard.state === 'done' && fields.bankBook.state === 'done';

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.successBox}>
          <p style={styles.successText}>已成功提交 KYC 審核！</p>
          <p style={styles.successSub}>通常 1–3 個工作天內完成審核，通過後將收到 LINE 通知。</p>
        </div>
        <button style={{ ...styles.submitBtn, marginTop: '16px' }} onClick={() => navigate('/agent')}>
          返回主頁
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/agent')}>
        ← 返回
      </button>
      <h1 style={styles.title}>KYC 身份認證</h1>
      <p style={styles.subtitle}>上傳以下文件供審核，通過後即可開始接單</p>

      {fieldDefs.map(({ label, key, category, ref }) => {
        const field = fields[key];
        return (
          <div key={key} style={styles.fieldBox}>
            <label style={styles.label}>{label}</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              ref={ref}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(key, category, file);
              }}
            />
            <div
              style={field.state === 'done' ? styles.uploadAreaDone : styles.uploadArea}
              onClick={() => ref.current?.click()}
            >
              {field.preview ? (
                <img src={field.preview} alt={label} style={styles.preview} />
              ) : (
                <span style={{ color: '#888', fontSize: '14px' }}>點擊選擇圖片</span>
              )}
            </div>
            {field.state === 'uploading' && <p style={{ ...styles.statusText, ...styles.uploading }}>上傳中…</p>}
            {field.state === 'done' && <p style={{ ...styles.statusText, ...styles.done }}>✓ 上傳完成</p>}
            {field.state === 'error' && <p style={{ ...styles.statusText, ...styles.error }}>上傳失敗，請重試</p>}
          </div>
        );
      })}

      {submitError && <p style={{ color: 'red', fontSize: '14px' }}>{submitError}</p>}

      <button
        style={allUploaded && !submitting ? styles.submitBtn : styles.submitBtnDisabled}
        disabled={!allUploaded || submitting}
        onClick={handleSubmit}
      >
        {submitting ? '提交中…' : '提交審核'}
      </button>
    </div>
  );
}
