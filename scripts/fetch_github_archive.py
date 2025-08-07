
import requests
import json
from datetime import datetime, timedelta
import gzip

def fetch_github_archive_data(start_date, end_date, repo_name):
    """
    Fetch star events from GitHub Archive for a specific repository
    """
    base_url = "https://data.githubarchive.org/"
    star_events = []
    
    current_date = start_date
    while current_date <= end_date:
        # Fetch data for each hour of the day
        for hour in range(24):
            hour_str = f"{hour:02d}"
            date_str = current_date.strftime("%Y-%m-%d")
            url = f"{base_url}{date_str}-{hour_str}.json.gz"
            
            try:
                response = requests.get(url)
                if response.status_code == 200:
                    # Decompress and parse JSON
                    data = json.loads(gzip.decompress(response.content))
                    
                    # Filter for star events for the specific repository
                    for event in data:
                        if (event.get('type') == 'WatchEvent' and 
                            event.get('repo', {}).get('name') == repo_name):
                            star_events.append({
                                'timestamp': event['created_at'],
                                'user': event['actor']['login'],
                                'action': event['payload']['action'],
                                'repository': event['repo']['name']
                            })
                            
            except Exception as e:
                print(f"Error fetching {url}: {e}")
                
        current_date += timedelta(days=1)
    
    return star_events

def process_star_events(events):
    """
    Process star events to create a timeline
    """
    # Sort by timestamp
    events.sort(key=lambda x: x['timestamp'])
    
    timeline = []
    running_count = 0
    
    for event in events:
        if event['action'] == 'started':
            running_count += 1
        elif event['action'] == 'deleted':
            running_count = max(0, running_count - 1)
        
        timeline.append({
            'timestamp': event['timestamp'],
            'count': running_count,
            'action': event['action'],
            'user': event['user']
        })
    
    return timeline

# Example usage
if __name__ == "__main__":
    from datetime import datetime
    
    # Set date range (repository created April 28, 2023)
    start_date = datetime(2023, 4, 28)
    end_date = datetime.now()
    repo_name = "promptfoo/promptfoo"
    
    print(f"Fetching star events for {repo_name} from {start_date} to {end_date}")
    
    # Fetch data
    events = fetch_github_archive_data(start_date, end_date, repo_name)
    print(f"Found {len(events)} star events")
    
    # Process timeline
    timeline = process_star_events(events)
    print(f"Created timeline with {len(timeline)} entries")
    
    # Save to file
    with open('promptfoo-github-archive-timeline.json', 'w') as f:
        json.dump(timeline, f, indent=2)
    
    print("Saved timeline to promptfoo-github-archive-timeline.json")
  