const url = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/assessments?select=*&limit=1';
const key = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}).then(res => res.json())
  .then(data => {
    console.log(data);
    process.exit(0);
  }).catch(err => {
    console.error('❌ FETCH ERROR:', err);
    process.exit(1);
  });
