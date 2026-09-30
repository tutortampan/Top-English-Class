const url = 'https://xuiszvwfjccvucqpactf.supabase.co/rest/v1/vocabulary_vault?select=theme,topic';
const key = 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}).then(res => res.json())
  .then(data => {
    const themes = {};
    for (const d of data) {
      if (!themes[d.theme]) themes[d.theme] = new Set();
      themes[d.theme].add(d.topic);
    }
    for (const t in themes) {
      console.log(`Theme '${t}' has ${themes[t].size} topics:`, Array.from(themes[t]));
    }
    process.exit(0);
  }).catch(err => {
    console.error('❌ FETCH ERROR:', err);
    process.exit(1);
  });
