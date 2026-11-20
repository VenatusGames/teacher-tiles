globalThis.TeacherTilesClassGrades = Object.freeze({
  allowsPbis(grade) { return !['9', '10', '11', '12', 'Higher-Ed'].includes(String(grade)); }
});
