import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiForm } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import MemberCard from '../components/MemberCard.jsx';
import PhotoCropper from '../components/PhotoCropper.jsx';
import { PROFESSION_CATEGORIES, SCHOOL_ROLES } from '../options.js';

const EMPTY = {
  branch: '',
  otherBranchOn: false,
  otherBranch: { branch: '', years: '' },
  fullName: '',
  nameAtSchool: '',
  email: '',
  phone: '',
  currentCity: '',
  address: '',
  profession: { category: '', title: '', workplace: '', showToMembers: false },
  yearJoined: '',
  batchYear: '',
  lastClass: '',
  house: '',
  admissionNo: '',
  schoolRoles: [],
  sports: '',
  otherAchievements: '',
  password: '',
  confirmPassword: '',
  consent: false,
};

export default function RegisterPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [cropping, setCropping] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    api('/branches').then((d) => setBranches(d.branches)).catch((e) => setError(e.message));
  }, []);

  // Preview link for the cropped photo, freed when it changes.
  const photoPreview = useMemo(() => (photoBlob ? URL.createObjectURL(photoBlob) : null), [photoBlob]);
  useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview]);

  const branch = branches.find((b) => b._id === form.branch);

  // ---- small helpers to update the form ----
  const field = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };
  const professionField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, profession: { ...f.profession, [key]: value } }));
  };
  const otherBranchField = (key) => (e) =>
    setForm((f) => ({ ...f, otherBranch: { ...f.otherBranch, [key]: e.target.value } }));
  const toggleRole = (role) =>
    setForm((f) => ({
      ...f,
      schoolRoles: f.schoolRoles.includes(role)
        ? f.schoolRoles.filter((r) => r !== role)
        : [...f.schoolRoles, role],
    }));

  function check() {
    if (!form.branch) return 'Choose the branch you studied at.';
    if (!photoBlob) return 'Add a photo for your membership card.';
    if (form.password.length < 8) return 'Use at least 8 characters for your password.';
    if (form.password !== form.confirmPassword) return 'The two passwords are different.';
    if (!form.consent) return 'Please tick the box to agree to share your details with members.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = check();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setBusy(true);

    const { otherBranchOn, confirmPassword, ...rest } = form;
    const data = {
      ...rest,
      otherBranch: otherBranchOn ? form.otherBranch : { branch: '', years: '' },
      batchYear: Number(form.batchYear),
      yearJoined: form.yearJoined ? Number(form.yearJoined) : '',
    };

    const body = new FormData();
    body.append('data', JSON.stringify(data));
    body.append('photo', photoBlob, 'photo.jpg');

    try {
      const res = await apiForm('/registrations', body);
      setDone(res.message);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="container page narrow">
        <h1>You're already a member</h1>
        <p><Link to="/card">See your membership card</Link>.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="container page narrow">
        <h1>Registration sent</h1>
        <div className="card">
          <p>{done}</p>
          <Link to="/" className="btn btn-navy">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page register-layout">
      <form className="register-form" onSubmit={handleSubmit} noValidate>
        <div>
          <h1>Join the association</h1>
          <p className="muted">Takes about three minutes. Fields marked * are required.</p>
        </div>

        {/* ---- Branch ---- */}
        <fieldset className="card fieldset">
          <legend>Your branch *</legend>
          <p className="muted small">
            Which branch of the school did you study at? Your batch, class list and coordinator
            all belong to this branch.
          </p>
          <div className="branch-picker">
            {branches.map((b) => (
              <label key={b._id} className={form.branch === b._id ? 'branch-option selected' : 'branch-option'}>
                <input type="radio" name="branch" value={b._id} checked={form.branch === b._id}
                  onChange={field('branch')} />
                <span className="branch-option-name">{b.name}</span>
              </label>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={form.otherBranchOn} onChange={field('otherBranchOn')} />
            I also studied at another branch
          </label>
          {form.otherBranchOn && (
            <div className="grid-fields">
              <label className="field">
                Other branch
                <select value={form.otherBranch.branch} onChange={otherBranchField('branch')}>
                  <option value="">Choose a branch</option>
                  {branches.filter((b) => b._id !== form.branch).map((b) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Years there
                <input type="text" placeholder="e.g. Grade 1 to 5" value={form.otherBranch.years}
                  onChange={otherBranchField('years')} />
              </label>
            </div>
          )}
        </fieldset>

        {/* ---- About you ---- */}
        <fieldset className="card fieldset">
          <legend>About you</legend>
          <div className="grid-fields">
            <label className="field">
              Full name *
              <input type="text" autoComplete="name" value={form.fullName} onChange={field('fullName')} required />
            </label>
            <label className="field">
              Name at school (if different)
              <input type="text" placeholder="So batchmates can find you" value={form.nameAtSchool}
                onChange={field('nameAtSchool')} />
            </label>
            <label className="field">
              Mobile number *
              <input type="tel" autoComplete="tel" placeholder="07X XXX XXXX" value={form.phone}
                onChange={field('phone')} required />
            </label>
            <label className="field">
              Email *
              <input type="email" autoComplete="email" value={form.email} onChange={field('email')} required />
            </label>
            <label className="field">
              Current city / country
              <input type="text" placeholder="e.g. Kandy, or Melbourne" value={form.currentCity}
                onChange={field('currentCity')} />
            </label>
          </div>
          <label className="field">
            Address
            <textarea rows="2" value={form.address} onChange={field('address')} />
          </label>

          <div className="subpanel">
            <span className="subpanel-title">Current occupation / profession</span>
            <div className="grid-fields">
              <label className="field">
                Field *
                <select value={form.profession.category} onChange={professionField('category')} required>
                  <option value="">Choose your field</option>
                  {PROFESSION_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="field">
                Job title
                <input type="text" placeholder="e.g. Consultant paediatrician" value={form.profession.title}
                  onChange={professionField('title')} />
              </label>
              <label className="field">
                Workplace / organisation
                <input type="text" placeholder="Optional" value={form.profession.workplace}
                  onChange={professionField('workplace')} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={form.profession.showToMembers}
                onChange={professionField('showToMembers')} />
              Let other members see my profession (the committee can always see it)
            </label>
          </div>
        </fieldset>

        {/* ---- Photo ---- */}
        <fieldset className="card fieldset">
          <legend>Your photo *</legend>
          <p className="muted small">
            This goes on your membership card. Only members and the committee can see it.
          </p>
          {cropping ? (
            <PhotoCropper
              onDone={(blob) => {
                setPhotoBlob(blob);
                setCropping(false);
              }}
              onCancel={photoBlob ? () => setCropping(false) : undefined}
            />
          ) : (
            <div className="row-actions">
              <span className="muted">Photo added. Check it on the card preview.</span>
              <button type="button" className="btn" onClick={() => setCropping(true)}>Change photo</button>
            </div>
          )}
        </fieldset>

        {/* ---- School years ---- */}
        <fieldset className="card fieldset">
          <legend>Your school years{branch ? ` at ${branch.name}` : ''}</legend>
          <div className="grid-fields">
            <label className="field">
              Year joined school
              <input type="number" inputMode="numeric" placeholder="YYYY" value={form.yearJoined}
                onChange={field('yearJoined')} />
            </label>
            <label className="field">
              Batch (year left) *
              <input type="number" inputMode="numeric" placeholder="YYYY" value={form.batchYear}
                onChange={field('batchYear')} required />
            </label>
            <label className="field">
              Last class *
              <input type="text" placeholder="e.g. 13 A, or A/L Bio" value={form.lastClass}
                onChange={field('lastClass')} required />
            </label>
            <label className="field">
              House
              {branch?.houses?.length ? (
                <select value={form.house} onChange={field('house')}>
                  <option value="">Choose your house</option>
                  {branch.houses.map((h) => <option key={h}>{h}</option>)}
                </select>
              ) : (
                <input type="text" value={form.house} onChange={field('house')} />
              )}
            </label>
            <label className="field">
              Admission number
              <input type="text" placeholder="If you remember it" value={form.admissionNo}
                onChange={field('admissionNo')} />
            </label>
          </div>

          <span className="subpanel-title">Roles you held at school</span>
          <div className="role-checks">
            {SCHOOL_ROLES.map((role) => (
              <label key={role} className="role-check">
                <input type="checkbox" checked={form.schoolRoles.includes(role)}
                  onChange={() => toggleRole(role)} />
                {role}
              </label>
            ))}
          </div>
          <div className="grid-fields">
            <label className="field">
              Sports you played or captained
              <input type="text" placeholder="e.g. Netball (captain), Athletics" value={form.sports}
                onChange={field('sports')} />
            </label>
            <label className="field">
              Other roles or achievements
              <input type="text" placeholder="Anything we missed" value={form.otherAchievements}
                onChange={field('otherAchievements')} />
            </label>
          </div>
        </fieldset>

        {/* ---- Login ---- */}
        <fieldset className="card fieldset">
          <legend>Your login</legend>
          <p className="muted small">
            You log in with your email and this password once your registration is approved.
          </p>
          <div className="grid-fields">
            <label className="field">
              Password * (at least 8 characters)
              <input type="password" autoComplete="new-password" value={form.password}
                onChange={field('password')} required />
            </label>
            <label className="field">
              Type the password again *
              <input type="password" autoComplete="new-password" value={form.confirmPassword}
                onChange={field('confirmPassword')} required />
            </label>
          </div>
        </fieldset>

        <label className="check">
          <input type="checkbox" checked={form.consent} onChange={field('consent')} />
          I agree that my name, branch, batch, class, school roles and photo are shown to other
          members. My phone, email and address are seen only by the committee.
        </label>

        {error && <p className="alert alert-error" role="alert">{error}</p>}

        <div className="row-actions">
          <button type="submit" className="btn btn-gold btn-lg" disabled={busy}>
            {busy ? 'Sending…' : 'Send registration'}
          </button>
          <Link to="/">Cancel</Link>
        </div>
      </form>

      <aside className="register-aside">
        <p className="eyebrow">Your card preview</p>
        <MemberCard
          name={form.fullName}
          branchName={branch?.name}
          batchYear={form.batchYear}
          lastClass={form.lastClass}
          schoolRoles={form.schoolRoles}
          photoUrl={photoPreview}
          status="Waiting for approval"
        />
        <div className="card steps-card">
          <h2>What happens next</h2>
          <ol>
            <li>The {branch ? branch.name : 'branch'} committee checks your details, usually within a few days.</li>
            <li>Once approved, log in with your email and password.</li>
            <li>Your card gets its member number and QR code. Show it at events in any city.</li>
          </ol>
        </div>
      </aside>
    </div>
  );
}
