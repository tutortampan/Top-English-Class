const url = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/assessments?select=id,prerequisite_id,program_id&limit=1';
const key = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}).then(res => res.json())
  .then(data => {
    if (data.error || data.message) {
      console.error('❌ ERROR:', data.message || data.error);
      process.exit(1);
    } else {
      console.log('✅ SUCCESS: Columns prerequisite_id and program_id exist!');
      console.log(data);
      process.exit(0);
    }
  }).catch(err => {
    console.error('❌ FETCH ERROR:', err);
    process.exit(1);
  });
