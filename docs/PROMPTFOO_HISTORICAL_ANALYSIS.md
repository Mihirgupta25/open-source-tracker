# Promptfoo Historical Star Growth Analysis

## 📊 Repository Information
- **Repository**: promptfoo/promptfoo
- **Created**: April 28, 2023
- **Current Stars**: 7,852 (as of August 4, 2025)
- **Analysis Period**: April 28, 2023 to July 24, 2025

## 🔍 Data Availability Assessment

### ✅ **Available Data Sources**

#### 1. **GitHub API (Recent Events Only)**
- **Coverage**: Recent events only (last few months)
- **Data Found**: 20 star events from August 2025
- **Limitation**: Cannot access historical data from 2023-2024
- **Sample Events**:
  - 2025-08-04: xtwigs, raindue9, godfather-ace
  - 2025-08-03: q121q, BrianP8701, evanfang0054
  - 2025-08-02: chuyouchia, wyv3rnnn, ftufkc

#### 2. **Current Stargazers List**
- **Coverage**: All current stargazers
- **Data**: 7,852 stargazers available
- **Limitation**: No timestamp information for when they starred

### ❌ **Unavailable Data Sources**

#### 1. **GitHub Archive API**
- **Status**: Not accessible (DNS resolution failed)
- **Reason**: Service may be deprecated or moved
- **Impact**: Cannot access historical events from 2023-2024

#### 2. **GitHub API Historical Events**
- **Status**: Limited to recent events only
- **Reason**: GitHub API design limitation
- **Impact**: Cannot access star events from repository creation

## 📈 **What We Can Determine**

### **Current State (August 2025)**
- **Total Stars**: 7,852
- **Recent Activity**: 20 star events in recent days
- **Growth Pattern**: Active star acquisition

### **Historical Gaps**
- **Missing Data**: Star events from April 2023 to July 2025
- **Time Period**: ~2 years of star growth history
- **Impact**: Cannot create complete historical timeline

## 🛠️ **Alternative Approaches**

### **1. BigQuery GitHub Archive**
```sql
-- This would work if you have BigQuery access
SELECT 
  created_at,
  actor.login as user,
  payload.action as action
FROM `githubarchive.day.events`
WHERE 
  type = 'WatchEvent' 
  AND repo.name = 'promptfoo/promptfoo'
  AND created_at >= '2023-04-28'
ORDER BY created_at ASC;
```

### **2. Third-Party Services**
- **GitHub Archive Downloads**: https://data.githubarchive.org/
- **GitHub Archive BigQuery**: Requires Google Cloud account
- **GitHub Archive API**: Currently inaccessible

### **3. Manual Data Collection**
- **Approach**: Use GitHub's web interface to manually collect data
- **Tool**: Browser automation or manual tracking
- **Limitation**: Time-consuming and not comprehensive

## 📋 **Recommendations**

### **Immediate Actions**
1. **Use Available Data**: Process the 20 recent star events
2. **Create Baseline**: Use current star count as reference point
3. **Monitor Going Forward**: Track new star events as they occur

### **Long-term Solutions**
1. **BigQuery Setup**: Set up Google Cloud account for GitHub Archive access
2. **Alternative APIs**: Explore other GitHub data providers
3. **Manual Collection**: Consider manual data collection for critical periods

## 📊 **Available Data Summary**

### **Recent Star Events (August 2025)**
```
Date: 2025-08-04
- xtwigs (started)
- raindue9 (started) 
- godfather-ace (started)
- ryuukaa (started)
- LanZhenFeng1 (started)
- khanhney (started)
- RickProductivity (started)

Date: 2025-08-03
- q121q (started)
- BrianP8701 (started)
- evanfang0054 (started)
- ftufkc (started)
- wyv3rnnn (started)
- chuyouchia (started)
```

### **Current Stargazers**
- **Total Count**: 7,852
- **Sample Users**: zilly-zilly, typpo, maxbaluev, vlameiras, orasik
- **Note**: No timestamp data available

## 🎯 **Conclusion**

**Historical star growth data for promptfoo/promptfoo from April 2023 to July 2025 is not accessible through standard GitHub APIs.**

**Available Options:**
1. **Use BigQuery GitHub Archive** (requires setup)
2. **Accept limited recent data** (August 2025 only)
3. **Manual data collection** (time-intensive)
4. **Focus on future tracking** (going forward)

**Recommendation**: Set up BigQuery access to GitHub Archive for comprehensive historical data, while using available recent data for immediate analysis. 