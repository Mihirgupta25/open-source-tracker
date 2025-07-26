import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface OpenSourceTrackerStackProps extends cdk.StackProps {
    environment: string;
    domainName?: string;
    githubTokenSecretName: string;
    dataCollectionSchedule: string;
}
export declare class OpenSourceTrackerStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: OpenSourceTrackerStackProps);
}
