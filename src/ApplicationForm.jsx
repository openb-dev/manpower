function Field({ label, value, onChange, type = "text", required = true, placeholder = "" }) {
  return (
    <label>
      {label}{required ? <span className="req"> *</span> : null}
      <input required={required} type={type} placeholder={placeholder} value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function fileField(setField, dataKey, nameKey) {
  return (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setField(dataKey, reader.result);
      setField(nameKey, file.name);
    };
    reader.readAsDataURL(file);
  };
}

export function blankFamily() {
  return Array.from({ length: 5 }, () => ({ name: "", relation: "", dateOfBirth: "", aadhaar: "", aadhaarLast4: "" }));
}

export function ApplicationFields({ form, setField, showGun = true, showAcceptance = true }) {
  function setMember(index, key, value) {
    const family = form.family.map((member, memberIndex) => memberIndex === index ? { ...member, [key]: value } : member);
    setField("family", family);
  }

  return (
    <>
      <p className="form-section">Application</p>
      <Field label="Father / husband name" value={form.fatherOrHusband} onChange={(value) => setField("fatherOrHusband", value)} />
      <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => setField("dateOfBirth", value)} />
      <Field label="Age" value={form.age} onChange={(value) => setField("age", value)} />
      <label className="span-2">
        Local address<span className="req"> *</span>
        <input required value={form.localAddress || ""} onChange={(event) => setField("localAddress", event.target.value)} />
      </label>
      <label className="span-2">
        Village address<span className="req"> *</span>
        <input required value={form.villageAddress || ""} onChange={(event) => setField("villageAddress", event.target.value)} />
      </label>
      <Field label="Qualification" value={form.qualification} onChange={(value) => setField("qualification", value)} />
      <Field label="Experience" value={form.experience} onChange={(value) => setField("experience", value)} />
      <Field label="Character certificate" value={form.characterCertificate} onChange={(value) => setField("characterCertificate", value)} />
      <Field label="Identification mark" value={form.identificationMark} onChange={(value) => setField("identificationMark", value)} />
      <Field label="Nationality" value={form.nationality} onChange={(value) => setField("nationality", value)} />
      <label>
        Religion<span className="req"> *</span>
        <select required value={form.religion || ""} onChange={(event) => setField("religion", event.target.value)}>
          <option value="">Select</option>
          <option>Hindu</option>
          <option>Muslim</option>
          <option>Christian</option>
          <option>Other</option>
        </select>
      </label>
      <Field label="Reference" value={form.reference} onChange={(value) => setField("reference", value)} />
      <Field label="Height" value={form.height} onChange={(value) => setField("height", value)} />
      <Field label="Weight" value={form.weight} onChange={(value) => setField("weight", value)} />
      <Field label="Chest" value={form.chest} onChange={(value) => setField("chest", value)} />
      <Field label="Nominee" value={form.nominee} onChange={(value) => setField("nominee", value)} />
      <label>
        Photo<span className="req"> *</span>
        <input type="file" accept="image/*" required={!form.photoName} onChange={fileField(setField, "photo", "photoName")} />
        {form.photoName ? <span className="file-name">{form.photoName}</span> : null}
      </label>

      <p className="form-section">Ex-serviceman</p>
      <Field label="Ex-serviceman no." value={form.exServiceNo} onChange={(value) => setField("exServiceNo", value)} />
      <Field label="Rank" value={form.exRank} onChange={(value) => setField("exRank", value)} />
      <Field label="Discharge date" type="date" value={form.exDischargeDate} onChange={(value) => setField("exDischargeDate", value)} />
      <Field label="Discharge book no." value={form.exDischargeBook} onChange={(value) => setField("exDischargeBook", value)} />

      {showGun ? (
        <>
          <p className="form-section">Gun licence</p>
          <Field label="Gun licence" value={form.gunLicence} onChange={(value) => setField("gunLicence", value)} />
          <Field label="Gun no." value={form.gunNo} onChange={(value) => setField("gunNo", value)} />
        </>
      ) : null}

      <p className="form-section">Declaration</p>
      <Field label="Mobile" value={form.mobile} onChange={(value) => setField("mobile", value)} />
      <label className="span-2">
        Present address<span className="req"> *</span>
        <input required value={form.presentAddress || ""} onChange={(event) => setField("presentAddress", event.target.value)} />
      </label>
      <Field label="Present PIN" value={form.presentPin} onChange={(value) => setField("presentPin", value)} />
      <label className="span-2">
        Permanent address<span className="req"> *</span>
        <input required value={form.permanentAddress || ""} onChange={(event) => setField("permanentAddress", event.target.value)} />
      </label>
      <Field label="Permanent PIN" value={form.permanentPin} onChange={(value) => setField("permanentPin", value)} />
      <label>
        Aadhaar no.<span className="req"> *</span>
        <input required={!form.aadhaarLast4} value={form.aadhaar || ""} placeholder={form.aadhaarLast4 ? `•••• ${form.aadhaarLast4}` : ""} onChange={(event) => setField("aadhaar", event.target.value)} />
      </label>
      <label>
        PAN<span className="req"> *</span>
        <input required={!form.panLast4} value={form.pan || ""} placeholder={form.panLast4 ? `•••• ${form.panLast4}` : ""} onChange={(event) => setField("pan", event.target.value)} />
      </label>
      <Field label="Previous employer" value={form.previousEmployer} onChange={(value) => setField("previousEmployer", value)} />
      <Field label="UAN" value={form.uan} onChange={(value) => setField("uan", value)} />
      <Field label="ESI IP no." value={form.esiIp} onChange={(value) => setField("esiIp", value)} />
      <Field label="Preferred dispensary" value={form.preferredDispensary} onChange={(value) => setField("preferredDispensary", value)} />

      <p className="form-section">Family</p>
      {(form.family || []).map((member, index) => (
        <div className="family-row" key={index}>
          <Field label="Name" value={member.name} onChange={(value) => setMember(index, "name", value)} />
          <Field label="Relation" value={member.relation} onChange={(value) => setMember(index, "relation", value)} />
          <Field label="Date of birth" type="date" value={member.dateOfBirth} onChange={(value) => setMember(index, "dateOfBirth", value)} />
          <label>
            Aadhaar no.<span className="req"> *</span>
            <input required={!member.aadhaarLast4} value={member.aadhaar || ""} placeholder={member.aadhaarLast4 ? `•••• ${member.aadhaarLast4}` : ""} onChange={(event) => setMember(index, "aadhaar", event.target.value)} />
          </label>
        </div>
      ))}
      <div className="book-actions">
        <button type="button" className="text-btn" onClick={() => setField("family", [...form.family, { name: "", relation: "", dateOfBirth: "", aadhaar: "", aadhaarLast4: "" }])}>
          Add family member
        </button>
      </div>

      <p className="form-section">Bank</p>
      <Field label="Bank name" placeholder="e.g. State Bank of India / HDFC Bank" value={form.bankName} onChange={(value) => setField("bankName", value)} />
      <label>
        A/C no.<span className="req"> *</span>
        <input required={!form.accountLast4} value={form.accountNo || ""} placeholder={form.accountLast4 ? `•••• ${form.accountLast4}` : "e.g. 123456789012"} onChange={(event) => setField("accountNo", event.target.value)} />
      </label>
      <Field label="IFSC" placeholder="e.g. SBIN0001234" value={form.ifsc} onChange={(value) => setField("ifsc", value)} />
      <Field label="Branch" placeholder="e.g. Park Street Branch, Kolkata" value={form.branchName} onChange={(value) => setField("branchName", value)} />

      <p className="form-section">Verification and deposit</p>
      <label>
        Police verification<span className="req"> *</span>
        <select required value={form.policeStatus || ""} onChange={(event) => setField("policeStatus", event.target.value)}>
          <option value="">Select</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <Field label="Security money" value={form.securityMoney} onChange={(value) => setField("securityMoney", value)} />
      {showAcceptance ? (
        <label>
          Joining terms accepted<span className="req"> *</span>
          <input type="checkbox" required checked={Boolean(form.joiningTerms)} onChange={(event) => setField("joiningTerms", event.target.checked)} />
        </label>
      ) : null}

      <p className="form-section">Documents</p>
      <label>
        Aadhaar<span className="req"> *</span>
        <input type="file" accept="image/*,.pdf" required={!form.aadhaarFileName} onChange={fileField(setField, "aadhaarFile", "aadhaarFileName")} />
        {form.aadhaarFileName ? <span className="file-name">{form.aadhaarFileName}</span> : null}
      </label>
      <label>
        PAN<span className="req"> *</span>
        <input type="file" accept="image/*,.pdf" required={!form.panFileName} onChange={fileField(setField, "panFile", "panFileName")} />
        {form.panFileName ? <span className="file-name">{form.panFileName}</span> : null}
      </label>
      <label>
        Bank passbook<span className="req"> *</span>
        <input type="file" accept="image/*,.pdf" required={!form.passbookFileName} onChange={fileField(setField, "passbookFile", "passbookFileName")} />
        {form.passbookFileName ? <span className="file-name">{form.passbookFileName}</span> : null}
      </label>
    </>
  );
}
