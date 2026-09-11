"""Clean all items from chargeguard-cases and chargeguard-decisions in AWS DynamoDB."""

import boto3

def clean_table(table_name: str, key_name: str, region_name: str = 'us-east-1'):
    ddb = boto3.resource('dynamodb', region_name=region_name)
    table = ddb.Table(table_name)
    
    scan = table.scan(ProjectionExpression=key_name)
    items = scan.get('Items', [])
    while 'LastEvaluatedKey' in scan:
        scan = table.scan(ProjectionExpression=key_name, ExclusiveStartKey=scan['LastEvaluatedKey'])
        items.extend(scan.get('Items', []))
        
    print(f"Deleting {len(items)} items from {table_name}...")
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={key_name: item[key_name]})
            
    print(f"Successfully cleaned {table_name}.")

def main():
    clean_table('chargeguard-cases', 'case_id')
    clean_table('chargeguard-decisions', 'decision_id')

if __name__ == '__main__':
    main()
