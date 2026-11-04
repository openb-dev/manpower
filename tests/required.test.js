import assert from "node:assert/strict";
import test from "node:test";
import { personError, personGaps } from "../server/data/required.js";

test("a blank person form lists the missing fields", () => {
  const gaps = personGaps({ name: "", application: { family: [] } });
  assert.ok(gaps.includes("Name"));
  assert.ok(gaps.includes("Original salary"));
  assert.ok(gaps.includes("Photo"));
  assert.ok(gaps.includes("Five family members"));
  assert.match(personError({ name: "Ramesh Das", application: { family: [] } }), /Fill every field/);
});

test("a complete person form has no gaps", () => {
  const family = Array.from({ length: 5 }, () => ({
    name: "Gopal Das",
    relation: "Father",
    dateOfBirth: "1965-01-10",
    aadhaar: "999988887777",
  }));
  const body = {
    name: "Ramesh Das",
    trade: "Sweeper",
    skill: "Unskilled",
    salary: "13000",
    attendance: "26",
    advance: "0",
    divisor: "26",
    deduct: "0",
    paymentDone: "13000",
    application: {
      fatherOrHusband: "Gopal Das",
      dateOfBirth: "1992-04-15",
      age: "34",
      localAddress: "New Town",
      villageAddress: "Village",
      qualification: "Class 10",
      experience: "2 years",
      characterCertificate: "Yes",
      identificationMark: "Mole",
      nationality: "Indian",
      religion: "Hindu",
      reference: "Kakoli Mondal, wife",
      height: "170",
      weight: "65",
      chest: "38",
      nominee: "Gopal Das",
      photoName: "photo.jpg",
      exServiceNo: "NA",
      exRank: "NA",
      exDischargeDate: "2010-01-01",
      exDischargeBook: "NA",
      gunLicence: "NA",
      gunNo: "NA",
      mobile: "9876543210",
      presentAddress: "New Town",
      presentPin: "700156",
      permanentAddress: "Village",
      permanentPin: "700001",
      aadhaar: "999988887777",
      pan: "ABCDE1234F",
      previousEmployer: "None",
      uan: "100000000000",
      esiIp: "123",
      preferredDispensary: "New Town",
      family,
      accountNo: "123456789",
      ifsc: "SBIN0001234",
      branchName: "New Town",
      policeStatus: "pending",
      securityMoney: "0",
      joiningTerms: true,
      aadhaarFileName: "aadhaar.pdf",
      panFileName: "pan.pdf",
      passbookFileName: "passbook.pdf",
    },
  };
  assert.deepEqual(personGaps(body), []);
});
