const url = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/vocabulary_vault?select=topic';
const key = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}).then(res => res.json())
  .then(data => {
    const topics = [...new Set(data.map(d => d.topic))].sort();
    console.log(`Found ${topics.length} topics:`, topics);
    process.exit(0);
  }).catch(err => {
    console.error('❌ FETCH ERROR:', err);
    process.exit(1);
  });
