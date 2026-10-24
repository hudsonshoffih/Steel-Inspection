output "public_ip" {
  description = "Put this in infrastructure/ansible/inventory.ini"
  value       = aws_instance.steel.public_ip
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_instance.steel.public_ip}"
}

output "instance_id" {
  value = aws_instance.steel.id
}
