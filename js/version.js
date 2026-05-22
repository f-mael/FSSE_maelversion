/**
 * Version Info Module
 * Dynamically pulls version and last updated info from repository
 */
const loadVersionInfo = async () => {
    const getEl = id => document.getElementById(id);
    try {
        const config = await (await fetch('config.json')).json();
        let version = config.version || '1.0.1', 
            dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 
            timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        
        try {
            const ghReq = await fetch('https://api.github.com/repos/devvyyxyz/wasteland-editor/commits?per_page=1');
            if (ghReq.ok) {
                const [commitData] = await ghReq.json();
                if (commitData?.commit?.committer?.date) {
                    const d = new Date(commitData.commit.committer.date);
                    dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                    timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                }
            }
        } catch (e) { console.info('GitHub API unavailable, using local time'); }
        
        if (getEl('app-version')) getEl('app-version').textContent = version;
        if (getEl('app-last-updated')) getEl('app-last-updated').textContent = `${dateStr} at ${timeStr}`;
    } catch (error) {
        console.warn('Could not load version info:', error);
        const n = new Date();
        if (getEl('app-version')) getEl('app-version').textContent = '1.0.1';
        if (getEl('app-last-updated')) getEl('app-last-updated').textContent = `${n.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
    }
};

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', loadVersionInfo) : loadVersionInfo();
