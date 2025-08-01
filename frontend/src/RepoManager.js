import React, { useState } from 'react';

const RepoManager = ({ 
  activeRepo, 
  setActiveRepo, 
  repos, 
  setRepos, 
  onRepoChange,
  onRepoRemove,
  isStaging 
}) => {
  const [newRepo, setNewRepo] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const addRepo = async () => {
    if (!newRepo.trim()) {
      setError('Please enter a repository name');
      return;
    }

    // Parse and validate repo format
    let repoToAdd = newRepo.trim();
    
    // Check if it's a full GitHub URL
    const githubUrlRegex = /^https?:\/\/github\.com\/([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)(?:\/.*)?$/;
    const githubUrlMatch = repoToAdd.match(githubUrlRegex);
    
    if (githubUrlMatch) {
      // Extract owner/repo from GitHub URL
      repoToAdd = githubUrlMatch[1];
    } else {
      // Check if it's already in owner/repo format
      const repoRegex = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
      if (!repoRegex.test(repoToAdd)) {
        setError('Please enter a valid repository in format: owner/repo or https://github.com/owner/repo (e.g., facebook/react or https://github.com/facebook/react)');
        return;
      }
    }

    setIsAdding(true);
    setError('');

    try {
      // Call backend to initialize repo data
      const response = await fetch('https://k3wr4zoexk.execute-api.us-east-1.amazonaws.com/prod/api/initialize-repo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repo: repoToAdd })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (!repos.includes(repoToAdd)) {
          const updatedRepos = [...repos, repoToAdd];
          setRepos(updatedRepos);
          setActiveRepo(repoToAdd);
          onRepoChange(repoToAdd);
        }
        setNewRepo('');
      } else {
        setError(data.error || 'Failed to add repository');
      }
    } catch (error) {
      setError('Failed to add repository: ' + error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const removeRepo = (repoToRemove) => {
    if (repos.length <= 1) {
      setError('Cannot remove the last repository');
      return;
    }

    onRepoRemove(repoToRemove);
  };

  if (!isStaging) {
    return null; // Only show in staging environment
  }

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '20px'
    }}>
      <h3 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>
        📁 Repository Management
      </h3>
      
      {/* Add new repository */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
              type="text"
              value={newRepo}
              onChange={(e) => setNewRepo(e.target.value)}
              placeholder="owner/repo or full URL (e.g., facebook/react or https://github.com/facebook/react)"
              style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            onKeyPress={(e) => e.key === 'Enter' && addRepo()}
          />
          <button
            onClick={addRepo}
            disabled={isAdding}
            style={{
              backgroundColor: isAdding ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: isAdding ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isAdding ? 'Adding...' : 'Add Repo'}
          </button>
        </div>
        {error && (
          <p style={{ color: '#ef4444', fontSize: '14px', margin: '8px 0 0 0' }}>
            {error}
          </p>
        )}
      </div>

      {/* Repository tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {repos.map((repo) => (
          <div
            key={repo}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: activeRepo === repo ? '#3b82f6' : '#e5e7eb',
              color: activeRepo === repo ? 'white' : '#374151',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s ease'
            }}
            onClick={() => {
              setActiveRepo(repo);
              onRepoChange(repo);
            }}
          >
            <span>{repo}</span>
            {repos.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeRepo(repo);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeRepo === repo ? 'white' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '0',
                  margin: '0',
                  lineHeight: '1'
                }}
                title="Remove repository"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <p style={{ 
        fontSize: '12px', 
        color: '#6b7280', 
        margin: '12px 0 0 0',
        fontStyle: 'italic'
      }}>
        Click on a repository tab to switch between different repositories. 
        Each repository will have its own data collection and charts.
        You can enter repositories as "owner/repo" or full GitHub URLs.
      </p>
    </div>
  );
};

export default RepoManager; 