variable "region" {
  description = "AWS region. Must match the region where your key pair exists."
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "Use a 4 GiB RAM type your account can use for free (the same one as your manual server)."
  type        = string
  default     = "c7i-flex.large"
}

variable "key_name" {
  description = "Name of the existing EC2 key pair"
  type        = string
  default     = "steel-key"
}

variable "my_ip_cidr" {
  description = "Your public IP with /32, for example 203.0.113.7/32. SSH is allowed only from here."
  type        = string

  validation {
    condition     = can(cidrhost(var.my_ip_cidr, 0)) && var.my_ip_cidr != "0.0.0.0/0"
    error_message = "Give a valid CIDR such as 203.0.113.7/32 (0.0.0.0/0 is not allowed for SSH)."
  }
}
