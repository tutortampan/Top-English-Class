// js/admin/board_import.js
import { getSupabase } from '../supabase.js?v=4.7.0';

export async function handleExcelRosterImport(file) {
  const data = await file.arrayBuffer();
  // Assume XLSX is available globally
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);

  const sb = await getSupabase();
  let importedCount = 0;

  for (const row of rows) {
    const institutionName = (row.INSTITUTION || '').trim();
    const programName = (row.PROGRAM || '').trim();
    const batchName = (row.BATCH || '').trim();
    const studentName = (row.NAME || '').trim();

    if (!institutionName || !programName || !batchName || !studentName) continue;

    // 1. Upsert Institution
    let { data: inst } = await sb.from('institutions').select('id').eq('name', institutionName).single();
    if (!inst) {
      const { data: newInst } = await sb.from('institutions').insert({ name: institutionName }).select('id').single();
      inst = newInst;
    }

    // 2. Upsert Program (Start/Finish formal academic naming)
    let { data: prog } = await sb.from('programs').select('id').eq('name', programName).eq('institution_id', inst.id).single();
    if (!prog) {
      const { data: newProg } = await sb.from('programs').insert({
        name: programName,
        institution_id: inst.id,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
      }).select('id').single();
      prog = newProg;
    }

    // 3. Upsert Batch (Enrollment/Graduation formal academic naming)
    let { data: batch } = await sb.from('batches').select('id').eq('name', batchName).eq('program_id', prog.id).single();
    if (!batch) {
      const { data: newBatch } = await sb.from('batches').insert({
        name: batchName,
        program_id: prog.id,
        enrollment_date: new Date().toISOString().split('T')[0],
        graduation_date: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split('T')[0]
      }).select('id').single();
      batch = newBatch;
    }

    // 4. Insert Student with default PIN '1234' and Incomplete profile status
    await sb.from('students').insert({
      name: studentName,
      batch_id: batch.id,
      program_id: prog.id,
      institution_id: inst.id,
      pin: '1234',
      photo_status: 'incomplete'
    });

    importedCount++;
  }

  return importedCount;
}
